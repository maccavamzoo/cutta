import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { fuellingPlans } from "@/lib/db/schema";
import PlanView, { type StoredPlan } from "./PlanView";

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const windowEnd = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(fuellingPlans)
    .where(
      and(
        eq(fuellingPlans.clerkUserId, userId),
        gte(fuellingPlans.planDate, todayStr),
        lte(fuellingPlans.planDate, windowEndStr)
      )
    )
    .orderBy(fuellingPlans.planDate);

  const initialPlans: StoredPlan[] = rows.map((r) => ({
    id: r.id,
    planDate: r.planDate,
    calendarEventId: r.calendarEventId,
    meals: (r.meals as StoredPlan["meals"]) ?? [],
    onBikeFuelling: (r.onBikeFuelling as StoredPlan["onBikeFuelling"]) ?? null,
    supplements: (r.supplements as StoredPlan["supplements"]) ?? [],
    totalCalories: r.totalCalories,
    totalCarbsG: r.totalCarbsG,
    totalProteinG: r.totalProteinG,
    totalFatG: r.totalFatG,
    aiReasoning: r.aiReasoning,
    glycogenBattery: r.glycogenBattery,
    generatedAt: r.generatedAt.toISOString(),
  }));

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          ← Home
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-white">
          14-day plan
        </h1>
      </div>

      <PlanView initialPlans={initialPlans} />
    </main>
  );
}
