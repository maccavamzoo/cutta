import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, complianceLog, feedbackLog, userProfiles } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ProgressView, { type ProgressData } from "./ProgressView";

// ─── helpers ──────────────────────────────────────────────────────────────────

function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fmtDateLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const sumX  = points.reduce((a, p) => a + p.x, 0);
  const sumY  = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  const [profileRows, weightRows, complianceRows, energyRows] = await Promise.all([
    db
      .select({ targetWeightKg: userProfiles.targetWeightKg, unitSystem: userProfiles.unitSystem })
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

  const targetWeightKg = profileRows[0]?.targetWeightKg
    ? Number(profileRows[0].targetWeightKg)
    : null;

  const actualWeightPoints = weightRows.map((r) => ({
    date:    r.weighedAt.toISOString().split("T")[0],
    actual:  Math.round(Number(r.weightKg) * 10) / 10,
    bf:      r.bodyFatPct ? Math.round(Number(r.bodyFatPct) * 10) / 10 : null,
  }));

  // Linear regression on weight
  let projectedDate:    string | null = null;
  let slopeKgPerWeek:   number | null = null;
  let weightChartPoints: ProgressData["weightPoints"] = [];

  // Always build actual points first — chart must show even with 1 entry or same-day data
  weightChartPoints = actualWeightPoints.map((p) => ({
    date:   p.date,
    label:  fmtDateLabel(p.date),
    actual: p.actual,
  }));

  if (actualWeightPoints.length >= 2) {
    const firstDate = new Date(actualWeightPoints[0].date);
    const regPoints = actualWeightPoints.map((p) => ({
      x: daysBetween(firstDate, new Date(p.date)),
      y: p.actual,
    }));
    const reg = linearRegression(regPoints);

    if (reg) {
      slopeKgPerWeek = Math.round(reg.slope * 7 * 100) / 100;
      const lastPoint  = actualWeightPoints.at(-1)!;
      const lastDayIdx = daysBetween(firstDate, new Date(lastPoint.date));
      const todayIdx   = daysBetween(firstDate, new Date());

      // Attach projected anchor to last actual point so the projection line starts there
      weightChartPoints = weightChartPoints.map((p, i) => ({
        ...p,
        projected: i === weightChartPoints.length - 1 ? p.actual : undefined,
      }));

      // Project forward if slope is negative (losing weight) and target set
      if (reg.slope < -0.001 && targetWeightKg !== null) {
        const targetDayIdx = (targetWeightKg - reg.intercept) / reg.slope;
        const daysToTarget = Math.round(targetDayIdx - todayIdx);

        if (daysToTarget > 0 && daysToTarget < 730) {
          projectedDate = new Date(Date.now() + daysToTarget * 86_400_000).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          });

          // Add projection points every ~2 weeks from last actual to predicted date
          const stepDays = Math.max(7, Math.floor((targetDayIdx - lastDayIdx) / 6));
          for (let d = lastDayIdx + stepDays; d <= targetDayIdx + 1; d += stepDays) {
            const projWeight = Math.round((reg.slope * d + reg.intercept) * 10) / 10;
            if (projWeight < (targetWeightKg - 0.5)) break;
            const projDate = msToDateStr(firstDate.getTime() + d * 86_400_000);
            weightChartPoints.push({ date: projDate, label: fmtDateLabel(projDate), projected: projWeight });
          }
          // Ensure target point is included
          const targetDate = msToDateStr(firstDate.getTime() + Math.round(targetDayIdx) * 86_400_000);
          weightChartPoints.push({ date: targetDate, label: fmtDateLabel(targetDate), projected: targetWeightKg });
        }
      }
    }
  }

  // ── body fat trend ───────────────────────────────────────────────────────

  const bfPoints = actualWeightPoints
    .filter((p) => p.bf !== null)
    .map((p) => ({ date: p.date, label: fmtDateLabel(p.date), value: p.bf! }));

  // ── compliance stats ────────────────────────────────────────────────────

  const daysOnPlan = complianceRows.length;
  const good       = complianceRows.filter((r) => r.compliance === "yes" || r.compliance === "mostly").length;
  const compliancePct = daysOnPlan > 0 ? Math.round((good / daysOnPlan) * 100) : 0;

  // Streak: consecutive days from today backwards with yes/mostly
  let streak = 0;
  const compByDate = new Map(complianceRows.map((r) => [r.logDate, r.compliance]));
  for (let i = 0; i < 365; i++) {
    const d = msToDateStr(Date.now() - i * 86_400_000);
    const c = compByDate.get(d);
    if (c === "yes" || c === "mostly") streak++;
    else if (c === "no") break;
    else if (i > 0) break; // gap (no entry) — stop streak
  }

  // ── ride energy weekly averages ─────────────────────────────────────────

  const weekMap = new Map<string, number[]>();
  for (const r of energyRows) {
    if (!r.planDate) continue;
    const d = new Date(r.planDate + "T12:00:00Z");
    // ISO week start (Monday)
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
      avg:   Math.round((ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length) * 10) / 10,
    }));

  const data: ProgressData = {
    weightPoints:    weightChartPoints,
    targetWeightKg,
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
            unitSystem={(profileRows[0]?.unitSystem ?? "metric") as "metric" | "imperial"}
          />
        </div>
      </main>

      <BottomNav active="progress" />
    </>
  );
}
