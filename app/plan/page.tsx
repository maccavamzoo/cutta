import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  userActivityTypes,
  weeklyStrategies,
  complianceLog,
  feedbackLog,
} from "@/lib/db/schema";
import dynamic from "next/dynamic";
import type { StoredPlan, PlanCalendarEvent, PlanEngineData } from "./PlanView";

const PlanView = dynamic(() => import("./PlanView"), { ssr: false });
import BottomNav from "@/components/BottomNav";
import { getUserToday } from "@/lib/dates";
import { rowToActivityType } from "@/lib/protocol";
import { parseRate } from "@/lib/weight-projection";
import { getCurrentWeightKg, NoWeightLogError } from "@/lib/weight";
import { aggregateRecentFeedback } from "@/lib/recent-feedback";

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

  // Windows used for fetching + client-side engine assembly.
  // Yesterday is needed for: previousGlycogen carry-forward, previousDayHadTraining.
  // Today+6 covers the 7 day cards; Today+10 covers tomorrow→carb-loading lookaheads for the last visible day.
  const yesterday       = new Date(today.getTime() - 86_400_000);
  const yesterdayStr    = yesterday.toISOString().split("T")[0];
  const day6            = new Date(today.getTime() + 6 * 86_400_000);
  const day6Str         = day6.toISOString().split("T")[0];
  const day10           = new Date(today.getTime() + 10 * 86_400_000);

  // 7-day feedback lookback for guardrails (mirrors the fuelling-plan API routes).
  const sevenDaysAgo    = new Date(today.getTime() - 7 * 86_400_000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [
    planRows,
    eventRows,
    profileRows,
    activityTypeRows,
    strategyRows,
    complianceRows,
    feedbackRows,
  ] = await Promise.all([
    db
      .select({
        planDate:        fuellingPlans.planDate,
        calendarEventId: fuellingPlans.calendarEventId,
        meals:           fuellingPlans.meals,
        onBikeFuelling:  fuellingPlans.onBikeFuelling,
        totalCalories:   fuellingPlans.totalCalories,
        totalCarbsG:     fuellingPlans.totalCarbsG,
        totalProteinG:   fuellingPlans.totalProteinG,
        totalFatG:       fuellingPlans.totalFatG,
        aiReasoning:     fuellingPlans.aiReasoning,
        glycogenBattery: fuellingPlans.glycogenBattery,
        generatedAt:     fuellingPlans.generatedAt,
        id:              fuellingPlans.id,
      })
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          gte(fuellingPlans.planDate, yesterdayStr),
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
          gte(calendarEvents.scheduledAt, yesterday),
          lte(calendarEvents.scheduledAt, day10)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        targetWeightKg:               userProfiles.targetWeightKg,
        weightLossRate:               userProfiles.weightLossRate,
        unitSystem:                   userProfiles.unitSystem,
        updatedAt:                    userProfiles.updatedAt,
        restDayCarbsGPerKg:           userProfiles.restDayCarbsGPerKg,
        restDayProteinGPerKg:         userProfiles.restDayProteinGPerKg,
        foodExclusions:               userProfiles.foodExclusions,
        preferredFoods:               userProfiles.preferredFoods,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select()
      .from(userActivityTypes)
      .where(eq(userActivityTypes.clerkUserId, userId))
      .orderBy(userActivityTypes.sortOrder),

    db
      .select({
        id:             weeklyStrategies.id,
        updatedAt:      weeklyStrategies.updatedAt,
        ingredientPool: weeklyStrategies.ingredientPool,
      })
      .from(weeklyStrategies)
      .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
      .limit(1),

    db
      .select({ compliance: complianceLog.compliance })
      .from(complianceLog)
      .where(
        and(
          eq(complianceLog.clerkUserId, userId),
          gte(complianceLog.logDate, sevenDaysAgoStr),
        )
      ),

    db
      .select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating })
      .from(feedbackLog)
      .where(
        and(
          eq(feedbackLog.clerkUserId, userId),
          gte(feedbackLog.planDate, sevenDaysAgoStr),
        )
      ),
  ]);

  const profileRow = profileRows[0] ?? null;
  const unitSystem = (profileRow?.unitSystem ?? "metric") as "metric" | "imperial";

  // Activity types status
  const hasActivityTypes  = activityTypeRows.length > 0;
  const hasWeeklyStrategy = strategyRows.length > 0;

  // Weight — weight_log is the source of truth. Returns null if the user has
  // never weighed in (e.g. mid-onboarding); the engine needs a number so we
  // gate engine assembly on it below.
  let currentWeightKg: number | null = null;
  try {
    currentWeightKg = await getCurrentWeightKg(userId);
  } catch (err) {
    if (!(err instanceof NoWeightLogError)) throw err;
  }

  const targetWeightKg = profileRow?.targetWeightKg ? Number(profileRow.targetWeightKg) : null;
  const weightLossRateStr = profileRow?.weightLossRate ?? null;

  // Data-change timestamp for per-day staleness detection
  const changeDates: Date[] = [
    profileRow?.updatedAt,
    ...activityTypeRows.map((r) => r.updatedAt),
    strategyRows[0]?.updatedAt,
    ...eventRows.map((e) => e.updatedAt),
  ].filter((d): d is Date => d instanceof Date);
  const dataLastChangedAt = changeDates.length > 0
    ? new Date(Math.max(...changeDates.map((d) => d.getTime()))).toISOString()
    : null;

  // Only today and future plans are handed to the UI as StoredPlan rows; the
  // yesterday row is kept separately for glycogen carry-forward.
  const initialPlans: StoredPlan[] = planRows
    .filter((r) => r.planDate >= todayStr)
    .map((r) => ({
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

  const yesterdayPlanRow = planRows.find((r) => r.planDate === yesterdayStr) ?? null;
  const yesterdayPlan = yesterdayPlanRow
    ? { glycogenBattery: yesterdayPlanRow.glycogenBattery }
    : null;

  const planCalendarEvents: PlanCalendarEvent[] = eventRows.map((e) => ({
    id:              e.id,
    title:           e.title,
    eventType:       e.eventType,
    scheduledDate:   e.scheduledAt.toISOString().split("T")[0],
    scheduledAt:     e.scheduledAt.toISOString(),
    durationMinutes: e.durationMinutes,
    notes:           e.notes,
  }));

  // Assemble the per-request engine data. All non-per-day fields live here;
  // per-day assembly (events + brief) happens on the client.
  const engineData: PlanEngineData = {
    currentWeightKg,
    maintenanceCalories: profileRow?.estimatedMaintenanceCalories ?? null,
    weightLossRate:      parseRate(weightLossRateStr),
    foodExclusions:      (profileRow?.foodExclusions as string[] | null) ?? [],
    preferredFoods:      (profileRow?.preferredFoods as string[] | null) ?? [],
    restDayMacros: {
      carbs_g_per_kg:   Number(profileRow?.restDayCarbsGPerKg)   || 3,
      protein_g_per_kg: Number(profileRow?.restDayProteinGPerKg) || 2,
    },
    activityTypes:  activityTypeRows.map(rowToActivityType),
    ingredientPool: (strategyRows[0]?.ingredientPool as string[] | null) ?? null,
    recentFeedback: aggregateRecentFeedback(feedbackRows, complianceRows),
  };

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
            engineData={engineData}
            yesterdayPlan={yesterdayPlan}
            targetWeightKg={targetWeightKg}
            timezone={timezone}
          />
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
