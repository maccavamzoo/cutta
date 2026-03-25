import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  userProfiles,
  protocols,
  calendarEvents,
  trainingLog,
  fuellingPlans,
} from "@/lib/db/schema";
import {
  buildPlanPrompt,
  type DayPlanOutput,
  type PlanGenerationResponse,
} from "@/lib/ai/buildPlanPrompt";

export const maxDuration = 60; // Vercel: allow up to 60s

const DAYS = 3; // generate this many days per request

// ── helpers ──────────────────────────────────────────────────────────────────

function log(tag: string, msg: string, data?: unknown) {
  const prefix = `[fuelling-plan/generate] ${tag}:`;
  if (data !== undefined) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
}

function logError(tag: string, msg: string, err: unknown) {
  console.error(`[fuelling-plan/generate] ${tag}:`, msg, err);
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 0. Validate ANTHROPIC_API_KEY at request time (not module load) ───────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logError("init", "ANTHROPIC_API_KEY is not set in environment", undefined);
    return NextResponse.json(
      { error: "Server configuration error: ANTHROPIC_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log("auth", "User authenticated", userId);

  // ── 2. Parse optional startDate from body ────────────────────────────────
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStr = todayUTC.toISOString().split("T")[0];

  let startDate = todayUTC;

  try {
    const body = await req.json();
    if (body.startDate && typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
      startDate = new Date(body.startDate + "T00:00:00.000Z");
      log("config", `Using requested startDate: ${body.startDate}`);
    }
  } catch {
    // no body or invalid JSON — use today
  }

  const startStr  = startDate.toISOString().split("T")[0];
  const windowEnd = new Date(startDate.getTime() + DAYS * 24 * 60 * 60 * 1000);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  // Training log always looks back 7 days from today for context
  const sevenDaysAgo = new Date(todayUTC.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  log("config", `Generating ${DAYS} days: ${startStr} → ${windowEndStr}`);

  // ── 3. Fetch all required data in parallel ────────────────────────────────
  let dbResults: [
    (typeof userProfiles.$inferSelect)[],
    (typeof protocols.$inferSelect)[],
    (typeof calendarEvents.$inferSelect)[],
    (typeof trainingLog.$inferSelect)[],
  ];

  try {
    dbResults = await Promise.all([
      db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.clerkUserId, userId))
        .limit(1),

      db
        .select()
        .from(protocols)
        .where(
          and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true))
        )
        .limit(1),

      // Calendar events only within the generation window
      db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.clerkUserId, userId),
            gte(calendarEvents.scheduledAt, startDate),
            lte(calendarEvents.scheduledAt, windowEnd)
          )
        )
        .orderBy(calendarEvents.scheduledAt),

      // Training history: last 7 days from today for context regardless of startDate
      db
        .select()
        .from(trainingLog)
        .where(
          and(
            eq(trainingLog.clerkUserId, userId),
            gte(trainingLog.activityDate, sevenDaysAgoStr),
            lte(trainingLog.activityDate, todayStr),
            eq(trainingLog.confirmed, true)
          )
        )
        .orderBy(trainingLog.activityDate),
    ]) as typeof dbResults;
  } catch (err) {
    logError("db-fetch", "Database query failed", err);
    return NextResponse.json(
      { error: "Database error while loading your data. Please try again." },
      { status: 500 }
    );
  }

  const [profileRows, protocolRows, eventRows, trainingRows] = dbResults;

  log("fetch", "DB results", {
    profile: profileRows.length,
    protocols: protocolRows.length,
    calendarEvents: eventRows.length,
    trainingEntries: trainingRows.length,
  });

  // ── 4. Guard checks ───────────────────────────────────────────────────────
  const profile = profileRows[0];
  if (!profile) {
    log("guard", "No user profile found");
    return NextResponse.json(
      { error: "No profile found. Complete onboarding first." },
      { status: 422 }
    );
  }

  if (!profile.onboardingComplete) {
    log("guard", "Onboarding not complete");
    return NextResponse.json(
      { error: "Onboarding is not complete. Finish setting up your profile before generating a plan." },
      { status: 422 }
    );
  }

  const protocol = protocolRows[0];
  if (!protocol) {
    log("guard", "No active protocol found");
    return NextResponse.json(
      { error: "No active fuelling protocol found. Upload a protocol JSON file in Settings → Protocol." },
      { status: 422 }
    );
  }

  log("guard", "Guards passed");

  if (eventRows.length === 0) {
    log("info", `No calendar events in ${startStr}→${windowEndStr} — plan will be rest days`);
  }

  // ── 5. Build prompt and call Claude ──────────────────────────────────────
  const prompt = buildPlanPrompt(profile, protocol, eventRows, trainingRows, startDate, DAYS);

  log("claude", `Prompt built — ${prompt.length} chars`);
  log("claude", `Sending request to claude-sonnet-4-20250514 (${DAYS} days)…`);

  let raw: string;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000, // 3 days needs far fewer tokens than 14
      messages: [{ role: "user", content: prompt }],
    });

    log("claude", "Response received", {
      stop_reason:   message.stop_reason,
      input_tokens:  message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error(`Unexpected content block type: ${block.type}`);
    }
    raw = block.text;
  } catch (err) {
    logError("claude", "Anthropic API call failed", err);

    const anthropicErr = err as { status?: number; message?: string };
    if (anthropicErr.status === 401) {
      return NextResponse.json(
        { error: "Invalid ANTHROPIC_API_KEY. Check the key in your .env.local." },
        { status: 500 }
      );
    }
    if (anthropicErr.status === 429) {
      return NextResponse.json(
        { error: "Anthropic rate limit hit. Wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `AI generation failed: ${anthropicErr.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  // ── 6. Parse response ─────────────────────────────────────────────────────
  let parsed: PlanGenerationResponse;
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    parsed = JSON.parse(cleaned) as PlanGenerationResponse;
  } catch (err) {
    logError("parse", "JSON parse failed — raw response (first 500 chars):", raw.slice(0, 500));
    logError("parse", "Parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse AI response. Please try again." },
      { status: 502 }
    );
  }

  if (!Array.isArray(parsed.plans) || parsed.plans.length === 0) {
    logError("parse", "No plans array in response:", JSON.stringify(parsed).slice(0, 200));
    return NextResponse.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 502 }
    );
  }

  log("parse", `Parsed ${parsed.plans.length} day plans`);

  // ── 7. Upsert each day into fuelling_plans ────────────────────────────────
  const saved: DayPlanOutput[] = [];
  const failed: string[] = [];
  const now = new Date();

  for (const day of parsed.plans) {
    if (!day.date || typeof day.date !== "string") {
      log("upsert", "Skipping day with missing/invalid date", day);
      continue;
    }

    try {
      await db
        .insert(fuellingPlans)
        .values({
          clerkUserId:     userId,
          planDate:        day.date,
          calendarEventId: day.calendar_event_id ?? null,
          meals:           day.meals ?? [],
          onBikeFuelling:  day.on_bike_fuelling ?? null,
          supplements:     day.supplements ?? [],
          totalCalories:   day.total_calories   ?? null,
          totalCarbsG:     day.total_carbs_g    ?? null,
          totalProteinG:   day.total_protein_g  ?? null,
          totalFatG:       day.total_fat_g      ?? null,
          aiReasoning:     day.ai_reasoning     ?? null,
          glycogenBattery: day.glycogen_battery ?? null,
          generatedAt:     now,
          updatedAt:       now,
        })
        .onConflictDoUpdate({
          target: [fuellingPlans.clerkUserId, fuellingPlans.planDate],
          set: {
            calendarEventId: day.calendar_event_id ?? null,
            meals:           day.meals ?? [],
            onBikeFuelling:  day.on_bike_fuelling ?? null,
            supplements:     day.supplements ?? [],
            totalCalories:   day.total_calories   ?? null,
            totalCarbsG:     day.total_carbs_g    ?? null,
            totalProteinG:   day.total_protein_g  ?? null,
            totalFatG:       day.total_fat_g      ?? null,
            aiReasoning:     day.ai_reasoning     ?? null,
            glycogenBattery: day.glycogen_battery ?? null,
            generatedAt:     now,
            updatedAt:       now,
          },
        });

      saved.push(day);
    } catch (err) {
      logError("upsert", `Failed to save plan for ${day.date}`, err);
      failed.push(day.date);
    }
  }

  log("upsert", `Saved ${saved.length}, failed ${failed.length}`, {
    failed: failed.length > 0 ? failed : undefined,
  });

  return NextResponse.json({
    generated: saved.length,
    failed: failed.length,
    startDate: startStr,
    plans: saved,
  });
}
