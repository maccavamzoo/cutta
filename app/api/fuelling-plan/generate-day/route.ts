import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  userProfiles,
  userActivityTypes,
  calendarEvents,
  fuellingPlans,
  complianceLog,
  feedbackLog,
  weeklyStrategies,
} from "@/lib/db/schema";
import { computeDayBrief, resolveActivityType, type PlanEngineInput } from "@/lib/plan-engine";
import { buildDayPlanPrompt, type SingleDayPlanOutput } from "@/lib/ai/buildDayPlanPrompt";
import { rowToActivityType } from "@/lib/protocol";
import { parseRate } from "@/lib/weight-projection";
import { getCurrentWeightKg, NoWeightLogError } from "@/lib/weight";
import { aggregateRecentFeedback } from "@/lib/recent-feedback";

export const maxDuration = 30;

// ── helpers ───────────────────────────────────────────────────────────────────

function log(tag: string, msg: string, data?: unknown) {
  const prefix = `[fuelling-plan/generate-day] ${tag}:`;
  if (data !== undefined) { console.log(prefix, msg, data); } else { console.log(prefix, msg); }
}

function logError(tag: string, msg: string, err: unknown) {
  console.error(`[fuelling-plan/generate-day] ${tag}:`, msg, err);
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse and validate date ────────────────────────────────────────────
  let date: string;
  let primaryActivityEventId: number | null = null;
  try {
    const body = await req.json();
    date = body.date;
    if (body.primaryActivityEventId != null) {
      const n = Number(body.primaryActivityEventId);
      if (!Number.isNaN(n)) primaryActivityEventId = n;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'A valid "date" string (YYYY-MM-DD) is required.' },
      { status: 400 }
    );
  }

  const requestedDate = new Date(date + "T00:00:00.000Z");
  if (isNaN(requestedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date value." }, { status: 400 });
  }

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const maxAllowed  = new Date(todayUTC.getTime() + 10 * 86_400_000);

  if (requestedDate < todayUTC || requestedDate > maxAllowed) {
    return NextResponse.json(
      { error: "Date must be today or within the next 10 days." },
      { status: 400 }
    );
  }

  log("auth", `User ${userId} generating plan for ${date}`);

  // ── 3. Compute adjacent date strings ─────────────────────────────────────
  const dateStart    = requestedDate;
  const dateEnd      = new Date(dateStart.getTime() + 86_400_000 - 1);
  const tomorrowStart = new Date(dateStart.getTime() + 86_400_000);
  const tomorrowEnd   = new Date(tomorrowStart.getTime() + 86_400_000 - 1);
  const yesterdayStr  = new Date(dateStart.getTime() - 86_400_000).toISOString().split("T")[0];

  // Feedback lookback: always last 7 days from today
  const sevenDaysAgo    = new Date(todayUTC.getTime() - 7 * 86_400_000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // ── 4. Fetch all required data in parallel ────────────────────────────────
  let profileRows:       (typeof userProfiles.$inferSelect)[];
  let activityTypeRows:  (typeof userActivityTypes.$inferSelect)[];
  let todayEventRows:    (typeof calendarEvents.$inferSelect)[];
  let tomorrowEventRows: (typeof calendarEvents.$inferSelect)[];
  let yesterdayEventRows:(typeof calendarEvents.$inferSelect)[];
  let yesterdayPlanRows: (typeof fuellingPlans.$inferSelect)[];
  let complianceRows:    { compliance: string }[];
  let feedbackRows:      { feedbackType: string; rating: number }[];
  let strategyRows:      { ingredientPool: unknown }[];

  try {
    [
      profileRows,
      activityTypeRows,
      todayEventRows,
      tomorrowEventRows,
      yesterdayEventRows,
      yesterdayPlanRows,
      complianceRows,
      feedbackRows,
      strategyRows,
    ] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1),

      db.select().from(userActivityTypes).where(eq(userActivityTypes.clerkUserId, userId)).orderBy(userActivityTypes.sortOrder),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, dateStart),
          lte(calendarEvents.scheduledAt, dateEnd),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, tomorrowStart),
          lte(calendarEvents.scheduledAt, tomorrowEnd),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, new Date(dateStart.getTime() - 86_400_000)),
          lte(calendarEvents.scheduledAt, new Date(dateStart.getTime() - 1)),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(fuellingPlans).where(
        and(eq(fuellingPlans.clerkUserId, userId), eq(fuellingPlans.planDate, yesterdayStr))
      ).limit(1),

      db.select({ compliance: complianceLog.compliance }).from(complianceLog).where(
        and(
          eq(complianceLog.clerkUserId, userId),
          gte(complianceLog.logDate, sevenDaysAgoStr),
        )
      ),

      db.select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating })
        .from(feedbackLog)
        .where(
          and(
            eq(feedbackLog.clerkUserId, userId),
            gte(feedbackLog.planDate, sevenDaysAgoStr),
          )
        ),

      db.select({ ingredientPool: weeklyStrategies.ingredientPool })
        .from(weeklyStrategies)
        .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
        .limit(1),
    ]) as [
      typeof profileRows,
      typeof activityTypeRows,
      typeof todayEventRows,
      typeof tomorrowEventRows,
      typeof yesterdayEventRows,
      typeof yesterdayPlanRows,
      typeof complianceRows,
      typeof feedbackRows,
      typeof strategyRows,
    ];
  } catch (err) {
    logError("db-fetch", "Database query failed", err);
    return NextResponse.json(
      { error: "Database error while loading your data. Please try again." },
      { status: 500 }
    );
  }

  // ── 5. Guard checks ───────────────────────────────────────────────────────
  const profile = profileRows[0];
  if (!profile) {
    return NextResponse.json(
      { error: "No profile found. Complete onboarding first." },
      { status: 422 }
    );
  }
  if (!profile.onboardingComplete) {
    return NextResponse.json(
      { error: "Onboarding is not complete. Finish setting up your profile before generating a plan." },
      { status: 422 }
    );
  }

  if (activityTypeRows.length === 0) {
    return NextResponse.json(
      { error: "No activity types found. Go to Settings → Activity types and add at least one." },
      { status: 422 }
    );
  }

  if (!profile.estimatedMaintenanceCalories) {
    return NextResponse.json(
      { error: "Maintenance calories not set. Complete your profile first." },
      { status: 422 }
    );
  }

  let currentWeightKg: number;
  try {
    currentWeightKg = await getCurrentWeightKg(userId);
  } catch (err) {
    if (err instanceof NoWeightLogError) {
      return NextResponse.json(
        { error: "Log a weigh-in before generating a plan." },
        { status: 422 }
      );
    }
    throw err;
  }

  log("guard", "Guards passed");

  // ── 6. Convert DB rows to ActivityType[] ─────────────────────────────────
  const activityTypes = activityTypeRows.map(rowToActivityType);

  const restDayMacros = {
    carbs_g_per_kg:   Number(profile.restDayCarbsGPerKg) || 3,
    protein_g_per_kg: Number(profile.restDayProteinGPerKg) || 2,
  };

  // ── 7. Compute guardrail counts from feedback ────────────────────────────
  const recentFeedback = aggregateRecentFeedback(feedbackRows, complianceRows);

  // ── 8. Build PlanEngineInput ──────────────────────────────────────────────
  const yesterdayPlan    = yesterdayPlanRows[0] ?? null;
  const yesterdayMeals   = (yesterdayPlan?.meals as { name: string }[] | null)
    ?.map((m) => m.name) ?? [];
  const previousGlycogen = yesterdayPlan?.glycogenBattery ?? null;
  const previousDayHadTraining = yesterdayEventRows.some((e) => e.eventType !== "rest");

  // Resolve today's events with their activity types. Exclude rest events (no activity type).
  const todayEventsWithTypes = todayEventRows
    .map((row) => {
      const at = resolveActivityType(activityTypes, row.eventType);
      return at ? { row, activityType: at } : null;
    })
    .filter((x): x is { row: typeof todayEventRows[number]; activityType: typeof activityTypes[number] } => x !== null);

  // Determine the primary event (drives macro rule, meals, pre/during/post).
  // Priority: explicit param from client > fallback to longest event.
  let todayPrimaryRow: typeof todayEventRows[number] | null = null;
  if (primaryActivityEventId != null) {
    const match = todayEventsWithTypes.find((e) => e.row.id === primaryActivityEventId);
    if (match) todayPrimaryRow = match.row;
  }
  if (!todayPrimaryRow && todayEventsWithTypes.length > 0) {
    todayPrimaryRow = todayEventsWithTypes.reduce((a, b) =>
      (b.row.durationMinutes ?? 0) > (a.row.durationMinutes ?? 0) ? b : a
    ).row;
  }

  // Tomorrow: keep existing longest-wins behaviour (only used for carb-loading check)
  const tomorrowPrimaryRow = tomorrowEventRows.length > 0
    ? tomorrowEventRows.reduce((a, b) => (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a)
    : null;

  const todayActivityType    = todayPrimaryRow    ? resolveActivityType(activityTypes, todayPrimaryRow.eventType)    : null;
  const tomorrowActivityType = tomorrowPrimaryRow ? resolveActivityType(activityTypes, tomorrowPrimaryRow.eventType) : null;

  const input: PlanEngineInput = {
    currentWeightKg,
    maintenanceCalories:    profile.estimatedMaintenanceCalories,
    weightLossRate:         parseRate(profile.weightLossRate),
    foodExclusions:         (profile.foodExclusions as string[] | null) ?? [],
    preferredFoods:         (profile.preferredFoods as string[] | null) ?? [],
    restDayMacros,
    todayActivityType,
    tomorrowActivityType,
    todayEvent: todayPrimaryRow ? {
      id:              todayPrimaryRow.id,
      title:           todayPrimaryRow.title,
      scheduledAt:     todayPrimaryRow.scheduledAt.toISOString(),
      durationMinutes: todayPrimaryRow.durationMinutes,
    } : null,
    tomorrowEvent: tomorrowPrimaryRow ? {
      durationMinutes: tomorrowPrimaryRow.durationMinutes,
      scheduledAt:     tomorrowPrimaryRow.scheduledAt.toISOString(),
    } : null,
    todayEvents: todayEventsWithTypes.map(({ row, activityType }) => ({
      event: {
        id:              row.id,
        title:           row.title,
        scheduledAt:     row.scheduledAt.toISOString(),
        durationMinutes: row.durationMinutes,
      },
      activityType,
    })),
    yesterdayMeals,
    ingredientPool:         (strategyRows[0]?.ingredientPool as string[] | null) ?? null,
    recentFeedback,
    previousGlycogen,
    previousDayHadTraining,
  };

  // ── 9. Pre-compute the day brief ─────────────────────────────────────────
  const brief = computeDayBrief(input, date);
  log("engine", `Day brief computed — ${brief.dayType}, ${brief.totalCalories} kcal, ${brief.mealSlots.length} meal slots`);

  // ── 10. Build prompt and call Claude ──────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logError("init", "ANTHROPIC_API_KEY is not set", undefined);
    return NextResponse.json(
      { error: "Server configuration error: ANTHROPIC_API_KEY is not set." },
      { status: 500 }
    );
  }

  const prompt = buildDayPlanPrompt(brief);
  log("claude", `Prompt built — ${prompt.length} chars`);

  // Instantiate inside handler (project constraint)
  const anthropic = new Anthropic({ apiKey });

  let raw: string;
  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });

    log("claude", "Response received", {
      stop_reason:   message.stop_reason,
      input_tokens:  message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const block = message.content[0];
    if (block.type !== "text") throw new Error(`Unexpected block type: ${block.type}`);
    raw = block.text;
  } catch (err) {
    logError("claude", "Anthropic API call failed", err);
    const e = err as { status?: number; message?: string };
    if (e.status === 429) {
      return NextResponse.json(
        { error: "Anthropic rate limit hit. Wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `AI generation failed: ${e.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  // ── 11. Parse JSON response ───────────────────────────────────────────────
  let aiOutput: SingleDayPlanOutput;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    aiOutput = JSON.parse(cleaned) as SingleDayPlanOutput;
  } catch (err) {
    logError("parse", "JSON parse failed — raw (first 500 chars):", raw.slice(0, 500));
    logError("parse", "Parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse AI response. Please try again." },
      { status: 502 }
    );
  }

  if (!Array.isArray(aiOutput.meals) || aiOutput.meals.length === 0) {
    logError("parse", "No meals in response:", JSON.stringify(aiOutput).slice(0, 200));
    return NextResponse.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 502 }
    );
  }

  // ── 12. Upsert into fuelling_plans ────────────────────────────────────────
  const now = new Date();
  let savedPlan: typeof fuellingPlans.$inferSelect;

  try {
    const [row] = await db
      .insert(fuellingPlans)
      .values({
        clerkUserId:     userId,
        planDate:        date,
        calendarEventId: brief.trainingEvent?.id ?? null,
        meals:           aiOutput.meals,
        onBikeFuelling:  aiOutput.on_bike_fuelling ?? null,
        totalCalories:   brief.totalCalories,
        totalCarbsG:     brief.totalCarbsG,
        totalProteinG:   brief.totalProteinG,
        totalFatG:       brief.totalFatG,
        aiReasoning:     aiOutput.ai_reasoning ?? null,
        glycogenBattery: brief.glycogenBattery,
        generatedAt:     now,
        updatedAt:       now,
      })
      .onConflictDoUpdate({
        target: [fuellingPlans.clerkUserId, fuellingPlans.planDate],
        set: {
          calendarEventId: brief.trainingEvent?.id ?? null,
          meals:           aiOutput.meals,
          onBikeFuelling:  aiOutput.on_bike_fuelling ?? null,
          totalCalories:   brief.totalCalories,
          totalCarbsG:     brief.totalCarbsG,
          totalProteinG:   brief.totalProteinG,
          totalFatG:       brief.totalFatG,
          aiReasoning:     aiOutput.ai_reasoning ?? null,
          glycogenBattery: brief.glycogenBattery,
          generatedAt:     now,
          updatedAt:       now,
        },
      })
      .returning();

    savedPlan = row;
  } catch (err) {
    logError("upsert", `Failed to save plan for ${date}`, err);
    return NextResponse.json(
      { error: "Failed to save plan. Please try again." },
      { status: 500 }
    );
  }

  log("done", `Plan saved for ${date} — ${brief.dayType}, ${brief.totalCalories} kcal`);

  return NextResponse.json(
    {
      plan: savedPlan,
      brief: {
        dayType:          brief.dayType,
        totalCalories:    brief.totalCalories,
        calorieBreakdown: brief.calorieBreakdown,
        guardrails:       brief.guardrails,
      },
    },
    { status: 201 }
  );
}
