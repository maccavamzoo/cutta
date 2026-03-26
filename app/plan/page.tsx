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
        unitSystem:                   userProfiles.unitSystem,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),

    db
      .select({ weightKg: weightLog.weightKg })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.weighedAt))
      .limit(1),
  ]);

  const maintenance     = profileRows[0]?.estimatedMaintenanceCalories
    ? Number(profileRows[0].estimatedMaintenanceCalories)
    : null;
  const protocolContent = protocolRows[0]?.content as Record<string, Record<string, unknown>> | null;
  const unitSystem      = (profileRows[0]?.unitSystem ?? "metric") as "metric" | "imperial";

  // Rest-day calorie estimate from protocol
  const restDayCals = typeof protocolContent?.rest_day?.calories === "number"
    ? protocolContent.rest_day.calories
    : maintenance ? maintenance - 350 : null;

  // Daily weight-loss projection (kg/day based on calorie deficit)
  const dailyWeightLossKg = maintenance && restDayCals
    ? Math.max(0, (maintenance - restDayCals) / 7700)
    : null;

  const currentWeightKg = latestWeightRows[0]?.weightKg
    ? Number(latestWeightRows[0].weightKg)
    : profileRows[0]?.currentWeightKg
    ? Number(profileRows[0].currentWeightKg)
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
        <h1 className="text-xl font-bold tracking-tight text-white mb-5">Plan</h1>
        <PlanView
          initialPlans={initialPlans}
          calendarEvents={planCalendarEvents}
          calorieMeta={calorieMeta}
          todayStr={todayStr}
          currentWeightKg={currentWeightKg}
          dailyWeightLossKg={dailyWeightLossKg}
          unitSystem={unitSystem}
        />
      </main>
      <BottomNav active="plan" />
    </>
  );
}
