import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calendarEvents,
  fuellingPlans,
  complianceLog,
  feedbackLog,
  weightLog,
  trainingLog,
  userProfiles,
} from "@/lib/db/schema";
import { getDayBounds, getUserToday } from "@/lib/dates";
import { isPlanStale, getLastDataChange } from "@/lib/plan-staleness";
import type { StoredPlan } from "@/app/plan/PlanView";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date param (expected YYYY-MM-DD)" }, { status: 400 });
  }

  // Fetch timezone
  const [tzRow] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const timezone = tzRow?.timezone ?? "Europe/London";
  const { dayStart, dayEnd } = getDayBounds(timezone, date);

  const [eventRows, planRows, complianceRows, feedbackRows, weighInRows, trainingRows] =
    await Promise.all([
      db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.clerkUserId, userId),
            gte(calendarEvents.scheduledAt, dayStart),
            lt(calendarEvents.scheduledAt, dayEnd),
          )
        ),

      db
        .select()
        .from(fuellingPlans)
        .where(
          and(
            eq(fuellingPlans.clerkUserId, userId),
            eq(fuellingPlans.planDate, date),
          )
        )
        .limit(1),

      db
        .select({ compliance: complianceLog.compliance, notes: complianceLog.notes })
        .from(complianceLog)
        .where(
          and(
            eq(complianceLog.clerkUserId, userId),
            eq(complianceLog.logDate, date),
          )
        )
        .limit(1),

      db
        .select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating })
        .from(feedbackLog)
        .where(
          and(
            eq(feedbackLog.clerkUserId, userId),
            eq(feedbackLog.planDate, date),
          )
        ),

      db
        .select({ weightKg: weightLog.weightKg, bodyFatPct: weightLog.bodyFatPct })
        .from(weightLog)
        .where(
          and(
            eq(weightLog.clerkUserId, userId),
            eq(weightLog.logDate, date),
          )
        )
        .limit(1),

      db
        .select({
          source:            trainingLog.source,
          durationMinutes:   trainingLog.durationMinutes,
          distanceKm:        trainingLog.distanceKm,
          avgPowerWatts:     trainingLog.avgPowerWatts,
          estimatedCalories: trainingLog.estimatedCalories,
          perceivedEffort:   trainingLog.perceivedEffort,
        })
        .from(trainingLog)
        .where(
          and(
            eq(trainingLog.clerkUserId, userId),
            eq(trainingLog.activityDate, date),
          )
        )
        .limit(1),
    ]);

  // Build plan response (only meal names + timings). For today, drop the plan
  // when it's stale so the day-detail sheet matches /plan and /dashboard.
  // Past/future days render their stored plan as-is — staleness only applies
  // to today, where the user might still act on it.
  const planRow = planRows[0] ?? null;
  const { todayStr } = getUserToday(timezone);
  let planIsStaleForToday = false;
  if (planRow && date === todayStr) {
    const lastDataChange = await getLastDataChange(userId);
    planIsStaleForToday = isPlanStale({
      planGeneratedAt:   planRow.generatedAt,
      planHasOnBike:     planRow.onBikeFuelling != null,
      lastDataChange,
      currentIsTraining: eventRows.some((e) => e.eventType !== "rest"),
    });
  }

  const plan = planRow && !planIsStaleForToday
    ? {
        meals:           ((planRow.meals as StoredPlan["meals"]) ?? []).map((m) => ({ name: m.name, timing: m.timing })),
        totalCalories:   planRow.totalCalories,
        totalCarbsG:     planRow.totalCarbsG,
        totalProteinG:   planRow.totalProteinG,
        totalFatG:       planRow.totalFatG,
        aiReasoning:     planRow.aiReasoning,
        glycogenBattery: planRow.glycogenBattery,
      }
    : null;

  const complianceRow = complianceRows[0] ?? null;
  const weighIn       = weighInRows[0] ?? null;
  const training      = trainingRows[0] ?? null;

  return NextResponse.json({
    date,
    events: eventRows.map((ev) => ({
      id:              ev.id,
      title:           ev.title,
      eventType:       ev.eventType,
      scheduledAt:     ev.scheduledAt.toISOString(),
      durationMinutes: ev.durationMinutes,
      notes:           ev.notes,
    })),
    plan,
    compliance: complianceRow
      ? { compliance: complianceRow.compliance, notes: complianceRow.notes }
      : null,
    feedback: feedbackRows.map((f) => ({ feedbackType: f.feedbackType, rating: f.rating })),
    weighIn: weighIn
      ? {
          weightKg:   Number(weighIn.weightKg),
          bodyFatPct: weighIn.bodyFatPct != null ? Number(weighIn.bodyFatPct) : null,
        }
      : null,
    training: training
      ? {
          source:            training.source,
          durationMinutes:   training.durationMinutes,
          distanceKm:        training.distanceKm != null ? Number(training.distanceKm) : null,
          avgPowerWatts:     training.avgPowerWatts,
          estimatedCalories: training.estimatedCalories,
          perceivedEffort:   training.perceivedEffort,
        }
      : null,
  });
}
