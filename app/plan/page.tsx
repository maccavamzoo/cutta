import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte, lt, gt } from "drizzle-orm";
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
  const rule = isTraining ? c?.training_day?.calories : c?.rest_day?.calories;
  if (typeof rule === "number") return rule;
  if (!isTraining) return maintenance - 350;
  return maintenance;
}

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // 3-day window: today, +1, +2
  const day2    = new Date(today.getTime() + 2 * 86_400_000);
  const day2Str = day2.toISOString().split("T")[0];
  const day3    = new Date(today.getTime() + 3 * 86_400_000);

  // ── Clean up stale rows: past days and anything beyond day+2 ─────────────
  await Promise.all([
    db.delete(fuellingPlans).where(
      and(eq(fuellingPlans.clerkUserId, userId), lt(fuellingPlans.planDate, todayStr))
    ),
    db.delete(fuellingPlans).where(
      and(eq(fuellingPlans.clerkUserId, userId), gt(fuellingPlans.planDate, day2Str))
    ),
  ]);

  // ── Fetch plan data ───────────────────────────────────────────────────────
  const [planRows, eventRows, profileRows, protocolRows] = await Promise.all([
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
          lte(calendarEvents.scheduledAt, day3)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({ estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
  ]);

  const maintenance     = profileRows[0]?.estimatedMaintenanceCalories
    ? Number(profileRows[0].estimatedMaintenanceCalories)
    : null;
  const protocolContent = protocolRows[0]?.content ?? null;

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
    restDayCalories:     roughCalories(false, maintenance, protocolContent),
    trainingDayCalories: roughCalories(true,  maintenance, protocolContent),
  };

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 pb-32 max-w-lg mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-white mb-5">Fuelling plan</h1>
        <PlanView
          initialPlans={initialPlans}
          calendarEvents={planCalendarEvents}
          calorieMeta={calorieMeta}
          todayStr={todayStr}
        />
      </main>
      <BottomNav active="plan" />
    </>
  );
}
