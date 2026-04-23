import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  userActivityTypes,
  weightLog,
  weeklyStrategies,
} from "@/lib/db/schema";
import dynamic from "next/dynamic";
import type { StoredPlan, PlanCalendarEvent } from "./PlanView";

const PlanView = dynamic(() => import("./PlanView"), { ssr: false });
import type { ActivityTypeOption } from "./AddEventSheet";
import BottomNav from "@/components/BottomNav";
import { arrivalDate } from "@/lib/weight-projection";
import { getUserToday } from "@/lib/dates";

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Fetch timezone first so todayStr is correct in the user's local timezone
  const [tzRow] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const timezone = tzRow?.timezone ?? "Europe/London";
  const { todayStr, todayStart: today } = getUserToday(timezone);

  // 7-day window for meal plans: today through today+6
  const day6    = new Date(today.getTime() + 6 * 86_400_000);
  const day6Str = day6.toISOString().split("T")[0];
  // 10-day window for calendar events
  const day10 = new Date(today.getTime() + 10 * 86_400_000);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [planRows, eventRows, profileRows, activityTypeRows, latestWeightRows, strategyRows] =
    await Promise.all([
      db
        .select()
        .from(fuellingPlans)
        .where(
          and(
            eq(fuellingPlans.clerkUserId, userId),
            gte(fuellingPlans.planDate, todayStr),
            lte(fuellingPlans.planDate, day6Str)
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
        .select({
          name:                     userActivityTypes.name,
          description:              userActivityTypes.description,
          defaultDurationMinutes:   userActivityTypes.defaultDurationMinutes,
          carbsGPerKg:              userActivityTypes.carbsGPerKg,
          proteinGPerKg:            userActivityTypes.proteinGPerKg,
          updatedAt:                userActivityTypes.updatedAt,
        })
        .from(userActivityTypes)
        .where(eq(userActivityTypes.clerkUserId, userId))
        .orderBy(userActivityTypes.sortOrder),

      db
        .select({ weightKg: weightLog.weightKg, weighedAt: weightLog.weighedAt })
        .from(weightLog)
        .where(eq(weightLog.clerkUserId, userId))
        .orderBy(desc(weightLog.weighedAt))
        .limit(1),

      db
        .select({ id: weeklyStrategies.id, updatedAt: weeklyStrategies.updatedAt })
        .from(weeklyStrategies)
        .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
        .limit(1),
    ]);

  const profileRow  = profileRows[0] ?? null;
  const unitSystem  = (profileRow?.unitSystem ?? "metric") as "metric" | "imperial";

  // Activity types status
  const hasActivityTypes  = activityTypeRows.length > 0;
  const hasWeeklyStrategy = strategyRows.length > 0;

  // Weight & projection
  const weightLossRate  = profileRow?.weightLossRate ?? null;
  const currentWeightKg = latestWeightRows[0]?.weightKg
    ? Number(latestWeightRows[0].weightKg)
    : profileRow?.currentWeightKg
    ? Number(profileRow.currentWeightKg)
    : null;

  const targetWeightKg = profileRow?.targetWeightKg
    ? Number(profileRow.targetWeightKg)
    : null;

  const arrival    = (currentWeightKg != null && targetWeightKg != null)
    ? arrivalDate(currentWeightKg, targetWeightKg, weightLossRate, today)
    : null;
  const arrivalStr = arrival
    ? arrival.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  // Data-change timestamp for per-day staleness detection
  const changeDates: Date[] = [
    profileRows[0]?.updatedAt,
    ...activityTypeRows.map((r) => r.updatedAt),
    latestWeightRows[0]?.weighedAt,
    strategyRows[0]?.updatedAt,
    ...eventRows.map((e) => e.updatedAt),
  ].filter((d): d is Date => d instanceof Date);
  const dataLastChangedAt = changeDates.length > 0
    ? new Date(Math.max(...changeDates.map((d) => d.getTime()))).toISOString()
    : null;

  const initialPlans: StoredPlan[] = planRows.map((r) => ({
    id:              r.id,
    planDate:        r.planDate,
    calendarEventId: r.calendarEventId,
    meals:           (r.meals as StoredPlan["meals"]) ?? [],
    onBikeFuelling:  (r.onBikeFuelling as StoredPlan["onBikeFuelling"]) ?? null,
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
    notes:           e.notes,
  }));

  const activityTypes: ActivityTypeOption[] = activityTypeRows.map((at) => ({
    name:                     at.name,
    description:              at.description ?? "",
    default_duration_minutes: at.defaultDurationMinutes ?? 60,
    carbs_g_per_kg:           Number(at.carbsGPerKg),
    protein_g_per_kg:         Number(at.proteinGPerKg),
  }));

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6">
          <PlanView
            initialPlans={initialPlans}
            calendarEvents={planCalendarEvents}
            todayStr={todayStr}
            unitSystem={unitSystem}
            hasActiveProtocol={hasActivityTypes}
            hasWeeklyStrategy={hasWeeklyStrategy}
            dataLastChangedAt={dataLastChangedAt}
            activityTypes={activityTypes}
            targetWeightKg={targetWeightKg}
            arrivalStr={arrivalStr}
            timezone={timezone}
          />
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
