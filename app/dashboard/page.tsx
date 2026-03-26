import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  complianceLog,
  feedbackLog,
  weightLog,
} from "@/lib/db/schema";
import DailyDashboard, {
  type TodayPlan,
  type TodayEvent,
  type ProfileSnapshot,
} from "./DailyDashboard";
import type { ExistingCheckIn } from "./CheckInSheet";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Midnight boundaries in UTC
  const now    = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayStr   = todayStart.toISOString().split("T")[0];

  const VALID_FEEDBACK_TYPES = ["ride_energy", "gut_comfort", "hunger"] as const;

  const [clerkUser, planRows, eventRows, profileRows, complianceRows, feedbackRows, weightRows] = await Promise.all([
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

    db
      .select({
        weightKg:   weightLog.weightKg,
        bodyFatPct: weightLog.bodyFatPct,
      })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.weighedAt))
      .limit(1),
  ]);

  const planRow = planRows[0] ?? null;

  const todayPlan: TodayPlan | null = planRow
    ? {
        meals:           (planRow.meals           as TodayPlan["meals"])           ?? [],
        onBikeFuelling:  (planRow.onBikeFuelling  as TodayPlan["onBikeFuelling"])  ?? null,
        supplements:     (planRow.supplements     as TodayPlan["supplements"])     ?? [],
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
    intensity:       e.intensity,
    notes:           e.notes,
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
  const weightRow = weightRows[0] ?? null;
  const existingCheckIn: ExistingCheckIn | null = complianceEntry
    ? {
        compliance:  complianceEntry.compliance as ExistingCheckIn["compliance"],
        rideEnergy:  feedbackRows.find((f) => f.feedbackType === "ride_energy")?.rating ?? null,
        gutComfort:  feedbackRows.find((f) => f.feedbackType === "gut_comfort")?.rating ?? null,
        hunger:      feedbackRows.find((f) => f.feedbackType === "hunger")?.rating ?? null,
        weightKg:    weightRow ? Number(weightRow.weightKg)   : null,
        bodyFatPct:  weightRow?.bodyFatPct ? Number(weightRow.bodyFatPct) : null,
      }
    : null;

  const firstName = clerkUser?.firstName ?? null;
  const latestWeightKg   = weightRow ? Number(weightRow.weightKg)   : null;
  const latestBodyFatPct = weightRow?.bodyFatPct ? Number(weightRow.bodyFatPct) : null;
  const unitSystem = (profileRow?.unitSystem ?? "metric") as "metric" | "imperial";

  return (
    <DailyDashboard
      todayStr={todayStr}
      todayPlan={todayPlan}
      todayEvents={todayEvents}
      profile={profile}
      existingCheckIn={existingCheckIn}
      firstName={firstName}
      latestWeightKg={latestWeightKg}
      latestBodyFatPct={latestBodyFatPct}
      unitSystem={unitSystem}
    />
  );
}
