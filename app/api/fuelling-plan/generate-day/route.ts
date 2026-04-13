import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  userProfiles,
  protocols,
  calendarEvents,
  fuellingPlans,
  complianceLog,
  feedbackLog,
  weeklyStrategies,
} from "@/lib/db/schema";
import { computeDayBrief, resolveActivityType, type PlanEngineInput } from "@/lib/plan-engine";
import { buildDayPlanPrompt, type SingleDayPlanOutput } from "@/lib/ai/buildDayPlanPrompt";
import type { ProtocolFile } from "@/lib/protocol";

export const maxDuration = 30;

// ── helpers ───────────────────────────────────────────────────────────────────

function log(tag: string, msg: string, data?: unknown) {
  const prefix = `[fuelling-plan/generate-day] ${tag}:`;
  if (data !== undefined) { console.log(prefix, msg, data); } else { console.log(prefix, msg); }
}

function logError(tag: string, msg: string, err: unknown) {
  console.error(`[fuelling-plan/generate-day] ${tag}:`, msg, err);
}

function isNewFormatProtocol(content: unknown): content is ProtocolFile {
  if (typeof content !== "object" || content === null) return false;
  const c = content as Record<string, unknown>;
  return Array.isArray(c.activity_types) && (c.activity_types as unknown[]).length > 0;
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
  try {
    const body = await req.json();
    date = body.date;
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
  let protocolRows:      (typeof protocols.$inferSelect)[];
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
      protocolRows,
      todayEventRows,
      tomorrowEventRows,
      yesterdayEventRows,
      yesterdayPlanRows,
      complianceRows,
      feedbackRows,
      strategyRows,
    ] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1),

      db.select().from(protocols).where(
        and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true))
      ).limit(1),

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
      typeof protocolRows,
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

  const activeProtocol = protocolRows[0];
  if (!activeProtocol) {
    return NextResponse.json(
      { error: "No active fuelling protocol found. Go to Settings → Protocol and select one." },
      { status: 422 }
    );
  }
  if (!isNewFormatProtocol(activeProtocol.content)) {
    return NextResponse.json(
      { error: "Your active protocol is in an outdated format. Go to Settings → Protocol and select a new template." },
      { status: 422 }
    );
  }

  const protocol = activeProtocol.content;

  if (!profile.estimatedMaintenanceCalories) {
    return NextResponse.json(
      { error: "Maintenance calories not set. Complete your profile first." },
      { status: 422 }
    );
  }

  log("guard", "Guards passed");

  // ── 6. Compute guardrail counts from feedback ─────────────────────────────
  const hungerEntries = feedbackRows.filter((f) => f.feedbackType === "hunger");
  const energyEntries = feedbackRows.filter((f) => f.feedbackType === "ride_energy");
  const stoolEntries  = feedbackRows.filter((f) => f.feedbackType === "stool_health");

  const recentFeedback: PlanEngineInput["recentFeedback"] = {
    highHungerDays:    hungerEntries.filter((f) => f.rating >= 4).length,
    lowEnergyDays:     energyEntries.filter((f) => f.rating <= 2).length,
    looseStoolDays:    stoolEntries.filter((f)  => f.rating <= 2).length,
    constipatedDays:   stoolEntries.filter((f)  => f.rating >= 4).length,
    lowComplianceDays: complianceRows.filter((c) => c.compliance === "no").length,
  };

  // ── 7. Build PlanEngineInput ──────────────────────────────────────────────
  const yesterdayPlan    = yesterdayPlanRows[0] ?? null;
  const yesterdayMeals   = (yesterdayPlan?.meals as { name: string }[] | null)
    ?.map((m) => m.name) ?? [];
  const previousGlycogen = yesterdayPlan?.glycogenBattery ?? null;
  const previousDayHadTraining = yesterdayEventRows.some((e) => e.eventType !== "rest");

  // Resolve primary events and activity types
  const todayPrimaryRow = todayEventRows.length > 0
    ? todayEventRows.reduce((a, b) => (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a)
    : null;
  const tomorrowPrimaryRow = tomorrowEventRows.length > 0
    ? tomorrowEventRows.reduce((a, b) => (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a)
    : null;

  const todayActivityType    = todayPrimaryRow    ? resolveActivityType(protocol, todayPrimaryRow.eventType)    : null;
  const tomorrowActivityType = tomorrowPrimaryRow ? resolveActivityType(protocol, tomorrowPrimaryRow.eventType) : null;

  const input: PlanEngineInput = {
    currentWeightKg:        Number(profile.currentWeightKg ?? 75),
    maintenanceCalories:    profile.estimatedMaintenanceCalories,
    foodExclusions:         (profile.foodExclusions as string[] | null) ?? [],
    currentSupplements:     (profile.currentSupplements as string[] | null) ?? [],
    appetiteProfile:        profile.appetiteProfile ?? null,
    preferredFoods:         (profile.preferredFoods as string[] | null) ?? [],
    protocol,
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
    yesterdayMeals,
    ingredientPool:         (strategyRows[0]?.ingredientPool as string[] | null) ?? null,
    recentFeedback,
    previousGlycogen,
    previousDayHadTraining,
  };

  // ── 8. Pre-compute the day brief ─────────────────────────────────────────
  const brief = computeDayBrief(input, date);
  log("engine", `Day brief computed — ${brief.dayType}, ${brief.totalCalories} kcal, ${brief.mealSlots.length} meal slots`);

  // ── 9. Build prompt and call Claude ──────────────────────────────────────
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

  // ── 10. Parse JSON response ───────────────────────────────────────────────
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

  // ── 11. Upsert into fuelling_plans ────────────────────────────────────────
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
        supplements:     aiOutput.supplements ?? [],
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
          supplements:     aiOutput.supplements ?? [],
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
