import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt, lte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  complianceLog,
  feedbackLog,
  weightLog,
  userActivityTypes,
  weeklyStrategies,
} from "@/lib/db/schema";
import DailyDashboard, {
  type TodayPlan,
  type TodayEvent,
  type ProfileSnapshot,
} from "./DailyDashboard";
import type { ExistingCheckIn } from "./CheckInSheet";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import { getUserToday } from "@/lib/dates";
import { isPlanStale, getLastDataChange } from "@/lib/plan-staleness";
import {
  computeDayBrief,
  resolveActivityType,
  type DayBrief,
  type PlanEngineInput,
} from "@/lib/plan-engine";
import { rowToActivityType } from "@/lib/protocol";
import { parseRate } from "@/lib/weight-projection";
import { getCurrentWeightKg, NoWeightLogError } from "@/lib/weight";
import { aggregateRecentFeedback } from "@/lib/recent-feedback";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const VALID_FEEDBACK_TYPES = ["ride_energy", "gut_comfort", "hunger", "stool_health"] as const;

  // Fetch timezone first so we can compute the correct local date boundaries
  const [timezoneRow] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const { todayStr, todayStart, todayEnd } = getUserToday(timezoneRow?.timezone ?? null);

  // Yesterday/tomorrow windows for the deterministic day brief (glycogen
  // carry-forward + tomorrow's carb-loading lookahead).
  const yesterdayStart  = new Date(todayStart.getTime() - 86_400_000);
  const yesterdayEnd    = new Date(todayStart.getTime() - 1);
  const yesterdayStr    = yesterdayStart.toISOString().split("T")[0];
  const tomorrowStart   = todayEnd;
  const tomorrowEnd     = new Date(todayEnd.getTime() + 86_400_000);

  // 7-day feedback lookback for guardrails (mirrors the fuelling-plan API routes).
  const sevenDaysAgo    = new Date(todayStart.getTime() - 7 * 86_400_000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const [
    clerkUser,
    planRows,
    eventRows,
    profileRows,
    complianceTodayRows,
    feedbackTodayRows,
    weighInRows,
    activityTypeRows,
    strategyRows,
    yesterdayPlanRows,
    yesterdayEventRows,
    tomorrowEventRows,
    complianceWindowRows,
    feedbackWindowRows,
  ] = await Promise.all([
    currentUser(),
    db
      .select()
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          eq(fuellingPlans.planDate, todayStr)
        )
      )
      .limit(1),

    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, todayStart),
          lt(calendarEvents.scheduledAt, todayEnd)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({
        targetWeightKg:               userProfiles.targetWeightKg,
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        trackStoolHealth:             userProfiles.trackStoolHealth,
        unitSystem:                   userProfiles.unitSystem,
        weightLossRate:               userProfiles.weightLossRate,
        foodExclusions:               userProfiles.foodExclusions,
        preferredFoods:               userProfiles.preferredFoods,
        restDayCarbsGPerKg:           userProfiles.restDayCarbsGPerKg,
        restDayProteinGPerKg:         userProfiles.restDayProteinGPerKg,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select()
      .from(complianceLog)
      .where(
        and(
          eq(complianceLog.clerkUserId, userId),
          eq(complianceLog.logDate, todayStr)
        )
      )
      .limit(1),

    db
      .select()
      .from(feedbackLog)
      .where(
        and(
          eq(feedbackLog.clerkUserId, userId),
          eq(feedbackLog.planDate, todayStr),
          inArray(feedbackLog.feedbackType, [...VALID_FEEDBACK_TYPES])
        )
      ),

    // Today-only weigh-in (resets each day)
    db
      .select({
        weightKg:   weightLog.weightKg,
        bodyFatPct: weightLog.bodyFatPct,
      })
      .from(weightLog)
      .where(
        and(
          eq(weightLog.clerkUserId, userId),
          eq(weightLog.logDate, todayStr)
        )
      )
      .limit(1),

    db
      .select()
      .from(userActivityTypes)
      .where(eq(userActivityTypes.clerkUserId, userId))
      .orderBy(userActivityTypes.sortOrder),

    db
      .select({ ingredientPool: weeklyStrategies.ingredientPool })
      .from(weeklyStrategies)
      .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
      .limit(1),

    // Yesterday's plan — glycogen carry-forward for the brief
    db
      .select({ glycogenBattery: fuellingPlans.glycogenBattery })
      .from(fuellingPlans)
      .where(and(eq(fuellingPlans.clerkUserId, userId), eq(fuellingPlans.planDate, yesterdayStr)))
      .limit(1),

    // Yesterday's events — previousDayHadTraining flag for the brief
    db
      .select({ eventType: calendarEvents.eventType })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, yesterdayStart),
          lte(calendarEvents.scheduledAt, yesterdayEnd),
        )
      ),

    // Tomorrow's events — for the brief's carb-loading lookahead
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, tomorrowStart),
          lt(calendarEvents.scheduledAt, tomorrowEnd),
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    // 7-day compliance lookback for guardrails
    db
      .select({ compliance: complianceLog.compliance })
      .from(complianceLog)
      .where(
        and(
          eq(complianceLog.clerkUserId, userId),
          gte(complianceLog.logDate, sevenDaysAgoStr),
        )
      ),

    // 7-day feedback lookback for guardrails
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

  const planRow    = planRows[0]    ?? null;
  const profileRow = profileRows[0] ?? null;

  // Staleness — single shared rule, both routes call the same helper
  // server-side so their lastDataChange inputs cannot drift.
  const lastDataChange = await getLastDataChange(userId);

  const planIsStale = isPlanStale({
    planGeneratedAt:   planRow?.generatedAt ?? null,
    planHasOnBike:     planRow?.onBikeFuelling != null,
    lastDataChange,
    currentIsTraining: eventRows.some((e) => e.eventType !== "rest"),
  });

  // Stale plans render identically to no-plan — the brief does the maths.
  const todayPlan: TodayPlan | null = planRow && !planIsStale
    ? {
        meals:           (planRow.meals           as TodayPlan["meals"])           ?? [],
        onBikeFuelling:  (planRow.onBikeFuelling  as TodayPlan["onBikeFuelling"])  ?? null,
        totalCalories:   planRow.totalCalories,
        totalCarbsG:     planRow.totalCarbsG,
        totalProteinG:   planRow.totalProteinG,
        totalFatG:       planRow.totalFatG,
        aiReasoning:     planRow.aiReasoning,
        glycogenBattery: planRow.glycogenBattery,
      }
    : null;

  // Deterministic day brief — calories, macros, breakdown. Shown when todayPlan
  // is null (no plan or stale plan). Null when prerequisites are missing
  // (no weigh-in, no activity types, no maintenance). Same assembly as
  // /api/fuelling-plan/generate-day so the numbers match.
  let todayBrief: DayBrief | null = null;

  let currentWeightKg: number | null = null;
  try {
    currentWeightKg = await getCurrentWeightKg(userId);
  } catch (err) {
    if (!(err instanceof NoWeightLogError)) throw err;
  }

  if (
    currentWeightKg != null &&
    profileRow?.estimatedMaintenanceCalories != null &&
    activityTypeRows.length > 0
  ) {
    const activityTypes = activityTypeRows.map(rowToActivityType);

    const todayEventsWithTypes = eventRows
      .map((row) => {
        const at = resolveActivityType(activityTypes, row.eventType);
        return at ? { row, activityType: at } : null;
      })
      .filter((x): x is { row: typeof eventRows[number]; activityType: typeof activityTypes[number] } => x !== null);

    // Primary: if a prior plan exists and its calendarEventId still matches one
    // of today's events, honour that choice (user may have picked via the plan
    // page's ambiguity prompt). Otherwise longest-wins, same as generate-day.
    let todayPrimary: typeof eventRows[number] | null = null;
    if (planRow?.calendarEventId != null) {
      const match = todayEventsWithTypes.find((e) => e.row.id === planRow.calendarEventId);
      if (match) todayPrimary = match.row;
    }
    if (!todayPrimary && todayEventsWithTypes.length > 0) {
      todayPrimary = todayEventsWithTypes.reduce((a, b) =>
        (b.row.durationMinutes ?? 0) > (a.row.durationMinutes ?? 0) ? b : a
      ).row;
    }

    const tomorrowPrimary = tomorrowEventRows.length > 0
      ? tomorrowEventRows.reduce((a, b) =>
          (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a
        )
      : null;

    const todayActivityType    = todayPrimary    ? resolveActivityType(activityTypes, todayPrimary.eventType)    : null;
    const tomorrowActivityType = tomorrowPrimary ? resolveActivityType(activityTypes, tomorrowPrimary.eventType) : null;

    const input: PlanEngineInput = {
      currentWeightKg,
      maintenanceCalories: profileRow.estimatedMaintenanceCalories,
      weightLossRate:      parseRate(profileRow.weightLossRate),
      foodExclusions:      (profileRow.foodExclusions as string[] | null) ?? [],
      preferredFoods:      (profileRow.preferredFoods as string[] | null) ?? [],
      restDayMacros: {
        carbs_g_per_kg:   Number(profileRow.restDayCarbsGPerKg)   || 3,
        protein_g_per_kg: Number(profileRow.restDayProteinGPerKg) || 2,
      },
      todayActivityType,
      tomorrowActivityType,
      todayEvent: todayPrimary ? {
        id:              todayPrimary.id,
        title:           todayPrimary.title,
        scheduledAt:     todayPrimary.scheduledAt.toISOString(),
        durationMinutes: todayPrimary.durationMinutes,
      } : null,
      tomorrowEvent: tomorrowPrimary ? {
        durationMinutes: tomorrowPrimary.durationMinutes,
        scheduledAt:     tomorrowPrimary.scheduledAt.toISOString(),
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
      yesterdayMeals:         [],
      ingredientPool:         (strategyRows[0]?.ingredientPool as string[] | null) ?? null,
      recentFeedback:         aggregateRecentFeedback(feedbackWindowRows, complianceWindowRows),
      previousGlycogen:       yesterdayPlanRows[0]?.glycogenBattery ?? null,
      previousDayHadTraining: yesterdayEventRows.some((e) => e.eventType !== "rest"),
    };

    todayBrief = computeDayBrief(input, todayStr);
  }

  const todayEvents: TodayEvent[] = eventRows.map((e) => ({
    id:              e.id,
    title:           e.title,
    eventType:       e.eventType,
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

  const profile: ProfileSnapshot | null = profileRow
    ? {
        targetWeightKg: profileRow.targetWeightKg
          ? Number(profileRow.targetWeightKg)
          : null,
        maintenanceCalories: profileRow.estimatedMaintenanceCalories,
      }
    : null;

  const complianceEntry = complianceTodayRows[0] ?? null;
  const weighInRow = weighInRows[0] ?? null;
  const existingCheckIn: ExistingCheckIn | null = complianceEntry
    ? {
        compliance:   complianceEntry.compliance as ExistingCheckIn["compliance"],
        rideEnergy:   feedbackTodayRows.find((f) => f.feedbackType === "ride_energy")?.rating   ?? null,
        gutComfort:   feedbackTodayRows.find((f) => f.feedbackType === "gut_comfort")?.rating   ?? null,
        hunger:       feedbackTodayRows.find((f) => f.feedbackType === "hunger")?.rating        ?? null,
        stoolHealth:  feedbackTodayRows.find((f) => f.feedbackType === "stool_health")?.rating  ?? null,
      }
    : null;

  const firstName = clerkUser?.firstName ?? null;
  const timezone = timezoneRow?.timezone ?? "Europe/London";
  const todayWeighIn = weighInRow
    ? {
        weightKg:   Number(weighInRow.weightKg),
        bodyFatPct: weighInRow.bodyFatPct ? Number(weighInRow.bodyFatPct) : null,
      }
    : null;
  const unitSystem      = (profileRow?.unitSystem ?? "metric") as "metric" | "imperial";
  const trackStoolHealth = profileRow?.trackStoolHealth ?? false;

  return (
    <DailyDashboard
      todayStr={todayStr}
      todayPlan={todayPlan}
      todayBrief={todayBrief}
      todayEvents={todayEvents}
      profile={profile}
      existingCheckIn={existingCheckIn}
      firstName={firstName}
      todayWeighIn={todayWeighIn}
      trackStoolHealth={trackStoolHealth}
      unitSystem={unitSystem}
      timezone={timezone}
      activityTypes={activityTypes}
    />
  );
}
