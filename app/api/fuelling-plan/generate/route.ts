import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

const anthropic = new Anthropic();

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Fetch all required data in parallel ───────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const windowEnd = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [profileRows, protocolRows, eventRows, trainingRows] =
    await Promise.all([
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

      db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.clerkUserId, userId),
            gte(calendarEvents.scheduledAt, today),
            lte(calendarEvents.scheduledAt, windowEnd)
          )
        )
        .orderBy(calendarEvents.scheduledAt),

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
    ]);

  // ── 2. Validate prerequisites ────────────────────────────────────────────
  const profile = profileRows[0];
  if (!profile?.onboardingComplete) {
    return NextResponse.json(
      { error: "Complete onboarding before generating a plan." },
      { status: 422 }
    );
  }

  const protocol = protocolRows[0];
  if (!protocol) {
    return NextResponse.json(
      { error: "Upload an active fuelling protocol before generating a plan." },
      { status: 422 }
    );
  }

  // ── 3. Build prompt and call Claude ─────────────────────────────────────
  const prompt = buildPlanPrompt(
    profile,
    protocol,
    eventRows,
    trainingRows,
    today
  );

  let raw: string;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected non-text response from Claude.");
    }
    raw = block.text;
  } catch (err) {
    console.error("Claude plan generation error:", err);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 502 }
    );
  }

  // ── 4. Parse response ────────────────────────────────────────────────────
  let parsed: PlanGenerationResponse;
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    parsed = JSON.parse(cleaned) as PlanGenerationResponse;
  } catch (err) {
    console.error("Failed to parse Claude response:", raw.slice(0, 500), err);
    return NextResponse.json(
      { error: "Failed to parse AI response. Please try again." },
      { status: 502 }
    );
  }

  if (!Array.isArray(parsed.plans) || parsed.plans.length === 0) {
    return NextResponse.json(
      { error: "AI returned an unexpected plan format." },
      { status: 502 }
    );
  }

  // ── 5. Upsert each day into fuelling_plans ───────────────────────────────
  const saved: DayPlanOutput[] = [];
  const now = new Date();

  for (const day of parsed.plans) {
    if (!day.date || typeof day.date !== "string") continue;

    try {
      await db
        .insert(fuellingPlans)
        .values({
          clerkUserId:      userId,
          planDate:         day.date,
          calendarEventId:  day.calendar_event_id ?? null,
          meals:            day.meals ?? [],
          onBikeFuelling:   day.on_bike_fuelling ?? null,
          supplements:      day.supplements ?? [],
          totalCalories:    day.total_calories   ?? null,
          totalCarbsG:      day.total_carbs_g    ?? null,
          totalProteinG:    day.total_protein_g  ?? null,
          totalFatG:        day.total_fat_g      ?? null,
          aiReasoning:      day.ai_reasoning     ?? null,
          glycogenBattery:  day.glycogen_battery ?? null,
          generatedAt:      now,
          updatedAt:        now,
        })
        .onConflictDoUpdate({
          target: [fuellingPlans.clerkUserId, fuellingPlans.planDate],
          set: {
            calendarEventId:  day.calendar_event_id ?? null,
            meals:            day.meals ?? [],
            onBikeFuelling:   day.on_bike_fuelling ?? null,
            supplements:      day.supplements ?? [],
            totalCalories:    day.total_calories   ?? null,
            totalCarbsG:      day.total_carbs_g    ?? null,
            totalProteinG:    day.total_protein_g  ?? null,
            totalFatG:        day.total_fat_g      ?? null,
            aiReasoning:      day.ai_reasoning     ?? null,
            glycogenBattery:  day.glycogen_battery ?? null,
            generatedAt:      now,
            updatedAt:        now,
          },
        });

      saved.push(day);
    } catch (err) {
      console.error(`Failed to save plan for ${day.date}:`, err);
      // Continue — partial success is better than total failure
    }
  }

  return NextResponse.json({
    generated: saved.length,
    plans: saved,
  });
}
