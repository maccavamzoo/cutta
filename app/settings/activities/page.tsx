import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userActivityTypes } from "@/lib/db/schema";
import ActivityTypesView from "./ActivityTypesView";

export const metadata = {
  title: "Activity types — Cutta",
};

export default async function ActivityTypesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(userActivityTypes)
    .where(eq(userActivityTypes.clerkUserId, userId))
    .orderBy(userActivityTypes.sortOrder);

  const initial = rows.map((r) => ({
    id:                     r.id,
    name:                   r.name,
    description:            r.description ?? "",
    burnRateKcalPerMin:     Number(r.burnRateKcalPerMin) || 8,
    carbsGPerKg:            Number(r.carbsGPerKg) || 5,
    proteinGPerKg:          Number(r.proteinGPerKg) || 1.8,
    preActivity:            r.preActivity as { timing_hours_before: number; focus: string },
    duringActivity:         r.duringActivity as { carbs_per_hour: number; description: string } | null,
    postActivity:           r.postActivity as { timing_minutes_after: number; focus: string; protein_g_per_kg: number; carbs_g_per_kg: number },
    defaultDurationMinutes: r.defaultDurationMinutes,
    isRace:                 r.isRace,
  }));

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto pb-24">
      <ActivityTypesView initial={initial} />
    </main>
  );
}
