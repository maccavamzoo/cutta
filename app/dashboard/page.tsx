import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
} from "@/lib/db/schema";
import DailyDashboard, {
  type TodayPlan,
  type TodayEvent,
  type ProfileSnapshot,
} from "./DailyDashboard";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Midnight boundaries in UTC
  const now    = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayStr   = todayStart.toISOString().split("T")[0];

  const [planRows, eventRows, profileRows] = await Promise.all([
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

  return (
    <DailyDashboard
      todayStr={todayStr}
      todayPlan={todayPlan}
      todayEvents={todayEvents}
      profile={profile}
    />
  );
}
