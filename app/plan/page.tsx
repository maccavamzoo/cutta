import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  calendarEvents,
  userProfiles,
  protocols,
} from "@/lib/db/schema";
import PlanView, { type StoredPlan, type PlanCalendarEvent, type CalorieMeta } from "./PlanView";
import BottomNav from "@/components/BottomNav";

function roughCalories(
  isTraining: boolean,
  maintenance: number | null,
  protocolContent: unknown,
): number | null {
  if (!maintenance) return null;
  const c = protocolContent as Record<string, Record<string, unknown>> | null;
  const rule = isTraining
    ? c?.training_day?.calories
    : c?.rest_day?.calories;

  if (typeof rule === "number") return rule;
  if (!isTraining) return maintenance - 350; // "deficit"
  return maintenance;                         // "maintenance" / default
}

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr    = today.toISOString().split("T")[0];
  const windowEnd   = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  const [planRows, eventRows, profileRows, protocolRows] = await Promise.all([
    db
      .select()
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          gte(fuellingPlans.planDate, todayStr),
          lte(fuellingPlans.planDate, windowEndStr)
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
          lte(calendarEvents.scheduledAt, windowEnd)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        updatedAt: userProfiles.updatedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content, updatedAt: protocols.updatedAt })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
  ]);

  const maintenance = profileRows[0]?.estimatedMaintenanceCalories
    ? Number(profileRows[0].estimatedMaintenanceCalories)
    : null;
  const protocolContent = protocolRows[0]?.content ?? null;

  // Staleness: any calendar event / protocol / profile changed after the earliest generated plan
  const earliestPlanGenAt = planRows.length > 0
    ? planRows.reduce((min, p) => p.generatedAt < min ? p.generatedAt : min, planRows[0].generatedAt)
    : null;
  const latestCalendarUpdate = eventRows.length > 0
    ? eventRows.reduce((max, e) => e.updatedAt > max ? e.updatedAt : max, eventRows[0].updatedAt)
    : null;
  const planStale = earliestPlanGenAt !== null && (
    (latestCalendarUpdate  && latestCalendarUpdate  > earliestPlanGenAt) ||
    (protocolRows[0]?.updatedAt && protocolRows[0].updatedAt > earliestPlanGenAt) ||
    (profileRows[0]?.updatedAt  && profileRows[0].updatedAt  > earliestPlanGenAt)
  );

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
    durationMinutes: e.durationMinutes,
    intensity:       e.intensity,
    roughCalories:   roughCalories(
      e.eventType === "ride" || e.eventType === "race",
      maintenance,
      protocolContent,
    ),
  }));

  const calorieMeta: CalorieMeta = {
    maintenance,
    restDayCalories: roughCalories(false, maintenance, protocolContent),
    trainingDayCalories: roughCalories(true, maintenance, protocolContent),
  };

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 pb-24 max-w-lg mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-white mb-5">
          Fuelling plan
        </h1>
        <PlanView
          initialPlans={initialPlans}
          calendarEvents={planCalendarEvents}
          calorieMeta={calorieMeta}
          todayStr={todayStr}
          planStale={!!planStale}
        />
      </main>
      <BottomNav active="plan" />
    </>
  );
}
