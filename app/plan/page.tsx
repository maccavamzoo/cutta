import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte, lt, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  protocols,
  weightLog,
} from "@/lib/db/schema";
import PlanView, { type StoredPlan, type PlanCalendarEvent, type CalorieMeta } from "./PlanView";
import BottomNav from "@/components/BottomNav";
import { dailyLossKg, arrivalDate } from "@/lib/weight-projection";
import { kgToDisplay, weightLabel } from "@/lib/units";

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // 3-day window for meal plans: today, +1, +2
  const day2    = new Date(today.getTime() + 2 * 86_400_000);
  const day2Str = day2.toISOString().split("T")[0];
  // 10-day window for calendar events: today through today+9
  const day10 = new Date(today.getTime() + 10 * 86_400_000);

  // ── Clean up stale plan rows ───────────────────────────────────────────────
  await Promise.all([
    db.delete(fuellingPlans).where(
      and(eq(fuellingPlans.clerkUserId, userId), lt(fuellingPlans.planDate, todayStr))
    ),
    db.delete(fuellingPlans).where(
      and(eq(fuellingPlans.clerkUserId, userId), gt(fuellingPlans.planDate, day2Str))
    ),
  ]);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [planRows, eventRows, profileRows, protocolRows, latestWeightRows] = await Promise.all([
    db
      .select()
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          gte(fuellingPlans.planDate, todayStr),
          lte(fuellingPlans.planDate, day2Str)
        )
      )
      .orderBy(fuellingPlans.planDate),

    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, today),
          lte(calendarEvents.scheduledAt, day10)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        currentWeightKg:              userProfiles.currentWeightKg,
        targetWeightKg:               userProfiles.targetWeightKg,
        weightLossRate:               userProfiles.weightLossRate,
        unitSystem:                   userProfiles.unitSystem,
        updatedAt:                    userProfiles.updatedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content, updatedAt: protocols.updatedAt })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),

    db
      .select({ weightKg: weightLog.weightKg, weighedAt: weightLog.weighedAt })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.weighedAt))
      .limit(1),
  ]);

  const profileRow      = profileRows[0] ?? null;
  const maintenance     = profileRow?.estimatedMaintenanceCalories
    ? Number(profileRow.estimatedMaintenanceCalories)
    : null;
  const protocolContent = protocolRows[0]?.content as Record<string, Record<string, unknown>> | null;
  const unitSystem      = (profileRow?.unitSystem ?? "metric") as "metric" | "imperial";

  // Daily weight-loss projection (kg/day) from the user's selected rate
  const weightLossRate    = profileRow?.weightLossRate ?? null;
  const dailyWeightLossKg = dailyLossKg(weightLossRate);

  const currentWeightKg = latestWeightRows[0]?.weightKg
    ? Number(latestWeightRows[0].weightKg)
    : profileRow?.currentWeightKg
    ? Number(profileRow.currentWeightKg)
    : null;

  const targetWeightKg = profileRow?.targetWeightKg
    ? Number(profileRow.targetWeightKg)
    : null;

  // Arrival date: projected from today's weight at the selected rate
  const arrival     = (currentWeightKg != null && targetWeightKg != null)
    ? arrivalDate(currentWeightKg, targetWeightKg, weightLossRate, today)
    : null;
  const arrivalStr  = arrival
    ? arrival.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  // Compute the latest data-change timestamp so PlanView can detect per-day staleness
  const changeDates: Date[] = [
    profileRows[0]?.updatedAt,
    protocolRows[0]?.updatedAt,
    latestWeightRows[0]?.weighedAt,
    ...eventRows.map((e) => e.updatedAt),
  ].filter((d): d is Date => d instanceof Date);
  const dataLastChangedAt = changeDates.length > 0
    ? new Date(Math.max(...changeDates.map((d) => d.getTime()))).toISOString()
    : null;

  function roughCalories(isTraining: boolean): number | null {
    if (!maintenance) return null;
    const rule = isTraining
      ? protocolContent?.training_day?.calories
      : protocolContent?.rest_day?.calories;
    if (typeof rule === "number") return rule;
    if (!isTraining) return maintenance - 350;
    return maintenance;
  }

  const initialPlans: StoredPlan[] = planRows.map((r) => ({
    id:              r.id,
    planDate:        r.planDate,
    calendarEventId: r.calendarEventId,
    meals:           (r.meals as StoredPlan["meals"]) ?? [],
    onBikeFuelling:  (r.onBikeFuelling as StoredPlan["onBikeFuelling"]) ?? null,
    supplements:     (r.supplements as StoredPlan["supplements"]) ?? [],
    totalCalories:   r.totalCalories,
    totalCarbsG:     r.totalCarbsG,
    totalProteinG:   r.totalProteinG,
    totalFatG:       r.totalFatG,
    aiReasoning:     r.aiReasoning,
    glycogenBattery: r.glycogenBattery,
    generatedAt:     r.generatedAt.toISOString(),
  }));

  const planCalendarEvents: PlanCalendarEvent[] = eventRows.map((e) => ({
    id:              e.id,
    title:           e.title,
    eventType:       e.eventType,
    scheduledDate:   e.scheduledAt.toISOString().split("T")[0],
    scheduledAt:     e.scheduledAt.toISOString(),
    durationMinutes: e.durationMinutes,
    intensity:       e.intensity,
    notes:           e.notes,
    roughCalories:   roughCalories(e.eventType === "ride" || e.eventType === "race"),
  }));

  const calorieMeta: CalorieMeta = {
    maintenance,
    restDayCalories:     roughCalories(false),
    trainingDayCalories: roughCalories(true),
  };

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 pb-32 max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold tracking-tight text-white">Plan</h1>
          {targetWeightKg != null && arrivalStr && (
            <p className="text-zinc-500 text-sm mt-1">
              Target {kgToDisplay(targetWeightKg, unitSystem).toFixed(1)} {weightLabel(unitSystem)} · est. arrival {arrivalStr}
            </p>
          )}
        </div>
        <PlanView
          initialPlans={initialPlans}
          calendarEvents={planCalendarEvents}
          calorieMeta={calorieMeta}
          todayStr={todayStr}
          currentWeightKg={currentWeightKg}
          dailyWeightLossKg={dailyWeightLossKg}
          unitSystem={unitSystem}
          dataLastChangedAt={dataLastChangedAt}
        />
      </main>
      <BottomNav active="plan" />
    </>
  );
}
