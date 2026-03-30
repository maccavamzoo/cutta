import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, complianceLog, feedbackLog, userProfiles } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ProgressView, { type ProgressData } from "./ProgressView";
import { dailyLossKg, arrivalDate as computeArrival, RATE_KG_PER_WEEK } from "@/lib/weight-projection";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDateLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
  });
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  const [profileRows, weightRows, complianceRows, energyRows] = await Promise.all([
    db
      .select({
        targetWeightKg:  userProfiles.targetWeightKg,
        currentWeightKg: userProfiles.currentWeightKg,
        weightLossRate:  userProfiles.weightLossRate,
        targetSetAt:     userProfiles.targetSetAt,
        unitSystem:      userProfiles.unitSystem,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ weighedAt: weightLog.weighedAt, weightKg: weightLog.weightKg, bodyFatPct: weightLog.bodyFatPct })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(weightLog.weighedAt),

    db
      .select({ logDate: complianceLog.logDate, compliance: complianceLog.compliance })
      .from(complianceLog)
      .where(eq(complianceLog.clerkUserId, userId))
      .orderBy(desc(complianceLog.logDate)),

    db
      .select({ planDate: feedbackLog.planDate, rating: feedbackLog.rating })
      .from(feedbackLog)
      .where(
        and(
          eq(feedbackLog.clerkUserId, userId),
          eq(feedbackLog.feedbackType, "ride_energy"),
          gte(feedbackLog.loggedAt, ninetyDaysAgo)
        )
      )
      .orderBy(feedbackLog.planDate),
  ]);

  // ── weight chart data ────────────────────────────────────────────────────

  const profileRow     = profileRows[0] ?? null;
  const targetWeightKg = profileRow?.targetWeightKg ? Number(profileRow.targetWeightKg) : null;
  const weightLossRate = profileRow?.weightLossRate ?? null;
  const targetSetAt    = profileRow?.targetSetAt    ?? null;

  const actualWeightPoints = weightRows.map((r) => ({
    date:   r.weighedAt.toISOString().split("T")[0],
    actual: Math.round(Number(r.weightKg) * 10) / 10,
    bf:     r.bodyFatPct ? Math.round(Number(r.bodyFatPct) * 10) / 10 : null,
  }));

  // ── plan start point ─────────────────────────────────────────────────────

  let planStartDate:   Date;
  let planStartWeight: number | null = null;

  if (weightRows.length > 0) {
    if (targetSetAt) {
      // Find weight_log entry closest to when the goal was set
      const closest = weightRows.reduce((best, r) =>
        Math.abs(r.weighedAt.getTime() - targetSetAt.getTime()) <
        Math.abs(best.weighedAt.getTime() - targetSetAt.getTime()) ? r : best
      );
      planStartDate   = targetSetAt;
      planStartWeight = Number(closest.weightKg);
    } else {
      // Fallback: start from earliest weight entry
      planStartDate   = weightRows[0].weighedAt;
      planStartWeight = Number(weightRows[0].weightKg);
    }
  } else {
    planStartDate   = targetSetAt ?? new Date();
    planStartWeight = profileRow?.currentWeightKg ? Number(profileRow.currentWeightKg) : null;
  }

  // ── rate-based projections ───────────────────────────────────────────────

  const canProject =
    weightLossRate !== null &&
    weightLossRate !== "maintain" &&
    planStartWeight !== null &&
    targetWeightKg  !== null &&
    planStartWeight > targetWeightKg;

  const arrival = canProject
    ? computeArrival(planStartWeight!, targetWeightKg!, weightLossRate, planStartDate)
    : null;

  const slopeKgPerWeek = weightLossRate === "maintain"
    ? 0
    : weightLossRate !== null
      ? -(RATE_KG_PER_WEEK[weightLossRate] ?? 0.5)
      : null;

  const projectedDate = arrival
    ? arrival.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // ── build unified chart point map ────────────────────────────────────────

  const pointMap = new Map<string, ProgressData["weightPoints"][number]>();

  // Actual weight points
  for (const p of actualWeightPoints) {
    pointMap.set(p.date, { date: p.date, label: fmtDateLabel(p.date), actual: p.actual });
  }

  // Plan line + band (every 7 days from planStartDate to arrivalDate)
  if (canProject && planStartWeight !== null && arrival !== null) {
    const dailyPlan = dailyLossKg(weightLossRate);
    const dailyCons = RATE_KG_PER_WEEK.conservative / 7;
    const dailyAggr = RATE_KG_PER_WEEK.aggressive   / 7;

    const maxDays = Math.ceil((arrival.getTime() - planStartDate.getTime()) / 86_400_000);

    for (let d = 0; d <= maxDays; d += 7) {
      const pt      = new Date(planStartDate.getTime() + d * 86_400_000);
      const dateStr = pt.toISOString().split("T")[0];

      const planW = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyPlan * d) * 10) / 10);
      const consW = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyCons * d) * 10) / 10);
      const aggrW = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyAggr * d) * 10) / 10);

      const existing = pointMap.get(dateStr) ?? { date: dateStr, label: fmtDateLabel(dateStr) };
      pointMap.set(dateStr, {
        ...existing,
        plan:       planW,
        bandBottom: aggrW,
        bandSize:   Math.max(0, Math.round((consW - aggrW) * 10) / 10),
      });
    }

    // Ensure arrival date is included
    const arrStr     = arrival.toISOString().split("T")[0];
    const arrExisting = pointMap.get(arrStr) ?? { date: arrStr, label: fmtDateLabel(arrStr) };
    pointMap.set(arrStr, { ...arrExisting, plan: targetWeightKg!, bandBottom: targetWeightKg!, bandSize: 0 });
  }

  const weightChartPoints = Array.from(pointMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── body fat trend ───────────────────────────────────────────────────────

  const bfPoints = actualWeightPoints
    .filter((p) => p.bf !== null)
    .map((p) => ({ date: p.date, label: fmtDateLabel(p.date), value: p.bf! }));

  // ── compliance stats ────────────────────────────────────────────────────

  const daysOnPlan    = complianceRows.length;
  const good          = complianceRows.filter((r) => r.compliance === "yes" || r.compliance === "mostly").length;
  const compliancePct = daysOnPlan > 0 ? Math.round((good / daysOnPlan) * 100) : 0;

  let streak = 0;
  const compByDate = new Map(complianceRows.map((r) => [r.logDate, r.compliance]));
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
    const c = compByDate.get(d);
    if (c === "yes" || c === "mostly") streak++;
    else if (c === "no") break;
    else if (i > 0) break;
  }

  // ── ride energy weekly averages ─────────────────────────────────────────

  const weekMap = new Map<string, number[]>();
  for (const r of energyRows) {
    if (!r.planDate) continue;
    const d   = new Date(r.planDate + "T12:00:00Z");
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monday = new Date(d.getTime() - day * 86_400_000);
    const key = monday.toISOString().split("T")[0];
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(r.rating);
  }
  const energyPoints = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ratings]) => ({
      label: fmtDateLabel(date),
      avg:   Math.round((ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length) * 10) / 10,
    }));

  const data: ProgressData = {
    weightPoints:   weightChartPoints,
    targetWeightKg,
    weightLossRate,
    projectedDate,
    slopeKgPerWeek,
    bfPoints,
    stats: { daysOnPlan, streak, compliancePct, totalRatings: energyRows.length },
    energyPoints,
  };

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Progress</h1>
            <p className="text-zinc-500 text-sm mt-1">Your trends at a glance.</p>
          </div>

          <ProgressView
            data={data}
            unitSystem={(profileRow?.unitSystem ?? "metric") as "metric" | "imperial"}
          />
        </div>
      </main>

      <BottomNav active="progress" />
    </>
  );
}
