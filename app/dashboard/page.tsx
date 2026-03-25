import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  complianceLog,
  feedbackLog,
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

  const [planRows, eventRows, profileRows, complianceRows, feedbackRows] = await Promise.all([
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
  const existingCheckIn: ExistingCheckIn | null = complianceEntry
    ? {
        compliance: complianceEntry.compliance as ExistingCheckIn["compliance"],
        rideEnergy: feedbackRows.find((f) => f.feedbackType === "ride_energy")?.rating ?? null,
        gutComfort: feedbackRows.find((f) => f.feedbackType === "gut_comfort")?.rating ?? null,
        hunger:     feedbackRows.find((f) => f.feedbackType === "hunger")?.rating ?? null,
      }
    : null;

  return (
    <DailyDashboard
      todayStr={todayStr}
      todayPlan={todayPlan}
      todayEvents={todayEvents}
      profile={profile}
      existingCheckIn={existingCheckIn}
    />
  );
}
