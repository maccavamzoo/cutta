import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, complianceLog, feedbackLog, userProfiles } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ProgressView, { type ProgressData } from "./ProgressView";
import { dailyLossKg, arrivalDate as computeArrival, parseRate, AGGRESSIVE_KG_PER_WEEK, CONSERVATIVE_KG_PER_WEEK } from "@/lib/weight-projection";

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
  const rateKgPerWeek = parseRate(weightLossRate);
  const targetSetAt    = profileRow?.targetSetAt    ?? null;

  const actualWeightPoints = weightRows.map((r) => ({
    date:   r.weighedAt.toISOString().split("T")[0],
    actual: Math.round(Number(r.weightKg) * 10) / 10,
    bf:     r.bodyFatPct ? Math.round(Number(r.bodyFatPct) * 10) / 10 : null,
  }));

  // ── plan start point ─────────────────────────────────────────────────────

  let planStartDate:   Date;
  let planStartWeight: number | null = null;

  if (targetSetAt) {
    planStartDate = targetSetAt;
    // Use the most recent weight entry on or before the day the goal was set.
    // weightRows is ordered ascending, so the last matching entry is the right one.
    const goalDay = targetSetAt.toISOString().split("T")[0];
    const onOrBefore = weightRows.filter(
      (r) => r.weighedAt.toISOString().split("T")[0] <= goalDay
    );
    if (onOrBefore.length > 0) {
      planStartWeight = Number(onOrBefore[onOrBefore.length - 1].weightKg);
    } else if (weightRows.length > 0) {
      // All entries are after the goal date — use earliest available (closest to goal)
      planStartWeight = Number(weightRows[0].weightKg);
    } else {
      // No weight entries at all — chart can't render a plan line yet
      planStartWeight = null;
    }
  } else {
    // No goal set date — anchor from the earliest weight entry.
    if (weightRows.length > 0) {
      planStartDate   = weightRows[0].weighedAt;
      planStartWeight = Number(weightRows[0].weightKg);
    } else {
      planStartDate   = new Date();
      planStartWeight = null;
    }
  }


  // ── rate-based projections ───────────────────────────────────────────────

  const canProject =
    rateKgPerWeek   > 0 &&
    planStartWeight !== null &&
    targetWeightKg  !== null &&
    planStartWeight > targetWeightKg;

  const arrival = canProject
    ? computeArrival(planStartWeight!, targetWeightKg!, weightLossRate, planStartDate)
    : null;

  const slopeKgPerWeek = -rateKgPerWeek;

  const projectedDate = arrival
    ? arrival.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // ── build unified chart point map ────────────────────────────────────────

  type RawPoint = Omit<ProgressData["weightPoints"][number], "dayIndex">;
  const pointMap = new Map<string, RawPoint>();

  // Actual weight points
  for (const p of actualWeightPoints) {
    pointMap.set(p.date, { date: p.date, label: fmtDateLabel(p.date), actual: p.actual });
  }

  // Plan line + band — weekly anchors plus gap-fill for every point in the window
  if (canProject && planStartWeight !== null && arrival !== null) {
    const dailyPlan  = dailyLossKg(weightLossRate);
    const dailyCons  = CONSERVATIVE_KG_PER_WEEK / 7;
    const dailyAggr  = AGGRESSIVE_KG_PER_WEEK   / 7;
    const planStartMs = planStartDate.getTime();

    // Conservative rate is slowest — extend window to when it hits target
    const conservativeDays = Math.ceil((planStartWeight! - targetWeightKg!) / dailyCons);
    const consArrMs        = planStartMs + conservativeDays * 86_400_000;

    // Weekly plan line + band anchor points
    for (let d = 0; d <= conservativeDays; d += 7) {
      const pt      = new Date(planStartMs + d * 86_400_000);
      const dateStr = pt.toISOString().split("T")[0];
      const planW   = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyPlan * d) * 10) / 10);
      const bandLo  = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyAggr * d) * 10) / 10);
      const bandHi  = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyCons * d) * 10) / 10);
      const existing = pointMap.get(dateStr) ?? { date: dateStr, label: fmtDateLabel(dateStr) };
      pointMap.set(dateStr, { ...existing, plan: planW, bandLower: bandLo, bandUpper: bandHi });
    }

    // Close the band at the conservative arrival date
    const consArrStr = new Date(consArrMs).toISOString().split("T")[0];
    const consEx     = pointMap.get(consArrStr) ?? { date: consArrStr, label: fmtDateLabel(consArrStr) };
    pointMap.set(consArrStr, { ...consEx, plan: targetWeightKg!, bandLower: targetWeightKg!, bandUpper: targetWeightKg! });

    // Back-fill band values on every other point inside the plan window
    // (e.g. actual weigh-in dots between weekly anchors) so the stacked
    // Area has no undefined gaps. Use forEach to avoid Map iteration
    // incompatibility with the project's TS target.
    pointMap.forEach((point, dateStr) => {
      if (point.bandLower !== undefined) return;
      const ptMs = new Date(dateStr + "T12:00:00Z").getTime();
      if (ptMs < planStartMs || ptMs > consArrMs) return;
      const d      = (ptMs - planStartMs) / 86_400_000;
      const bandLo = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyAggr * d) * 10) / 10);
      const bandHi = Math.max(targetWeightKg!, Math.round((planStartWeight! - dailyCons * d) * 10) / 10);
      pointMap.set(dateStr, { ...point, bandLower: bandLo, bandUpper: bandHi });
    });
  }

  const sortedPoints = Array.from(pointMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Add dayIndex — integer days from the earliest date in the chart.
  // Recharts numeric axis uses this for proportional time spacing.
  const chartStartDate = sortedPoints.length > 0 ? sortedPoints[0].date : null;
  const chartStartMs   = chartStartDate
    ? new Date(chartStartDate + "T12:00:00Z").getTime()
    : 0;

  const weightChartPoints = sortedPoints.map((p) => ({
    ...p,
    dayIndex: Math.round(
      (new Date(p.date + "T12:00:00Z").getTime() - chartStartMs) / 86_400_000
    ),
  }));

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
    chartStartDate,
    targetWeightKg,
    weightLossRate: rateKgPerWeek,
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
