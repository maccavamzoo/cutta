import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  complianceLog,
  feedbackLog,
  weightLog,
  userActivityTypes,
} from "@/lib/db/schema";
import DailyDashboard, {
  type TodayPlan,
  type TodayEvent,
  type ProfileSnapshot,
} from "./DailyDashboard";
import type { ExistingCheckIn } from "./CheckInSheet";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import { getUserToday } from "@/lib/dates";

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

  const [clerkUser, planRows, eventRows, profileRows, complianceRows, feedbackRows, weighInRows, activityTypeRows] = await Promise.all([
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
        currentWeightKg:              userProfiles.currentWeightKg,
        targetWeightKg:               userProfiles.targetWeightKg,
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        trackStoolHealth:             userProfiles.trackStoolHealth,
        unitSystem:                   userProfiles.unitSystem,
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
      .select({
        name:                     userActivityTypes.name,
        description:              userActivityTypes.description,
        defaultDurationMinutes:   userActivityTypes.defaultDurationMinutes,
        carbsGPerKg:              userActivityTypes.carbsGPerKg,
        proteinGPerKg:            userActivityTypes.proteinGPerKg,
      })
      .from(userActivityTypes)
      .where(eq(userActivityTypes.clerkUserId, userId))
      .orderBy(userActivityTypes.sortOrder),
  ]);

  const planRow = planRows[0] ?? null;

  const todayPlan: TodayPlan | null = planRow
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

  const profileRow = profileRows[0] ?? null;
  const profile: ProfileSnapshot | null = profileRow
    ? {
        currentWeightKg: profileRow.currentWeightKg
          ? Number(profileRow.currentWeightKg)
          : null,
        targetWeightKg: profileRow.targetWeightKg
          ? Number(profileRow.targetWeightKg)
          : null,
        maintenanceCalories: profileRow.estimatedMaintenanceCalories,
      }
    : null;

  const complianceEntry = complianceRows[0] ?? null;
  const weighInRow = weighInRows[0] ?? null;
  const existingCheckIn: ExistingCheckIn | null = complianceEntry
    ? {
        compliance:   complianceEntry.compliance as ExistingCheckIn["compliance"],
        rideEnergy:   feedbackRows.find((f) => f.feedbackType === "ride_energy")?.rating   ?? null,
        gutComfort:   feedbackRows.find((f) => f.feedbackType === "gut_comfort")?.rating   ?? null,
        hunger:       feedbackRows.find((f) => f.feedbackType === "hunger")?.rating        ?? null,
        stoolHealth:  feedbackRows.find((f) => f.feedbackType === "stool_health")?.rating  ?? null,
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
