"use client";

import { useEffect, useState } from "react";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ProgressData {
  weightPoints: {
    date:      string;
    label:     string;
    actual?:   number;
    projected?: number;
  }[];
  targetWeightKg:  number | null;
  projectedDate:   string | null;
  slopeKgPerWeek:  number | null;

  bfPoints: { date: string; label: string; value: number }[];

  stats: {
    daysOnPlan:    number;
    streak:        number;
    compliancePct: number;
    totalRatings:  number;
  };

  energyPoints: { label: string; avg: number }[];
}

// ─── tooltip styles ───────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#e4e4e7",
};

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-zinc-600 text-sm text-center px-6">{message}</p>
    </div>
  );
}

// ─── weight chart ─────────────────────────────────────────────────────────────

function WeightChart({
  points,
  targetWeightKg,
  unitSystem,
}: {
  points:         ProgressData["weightPoints"];
  targetWeightKg: number | null;
  unitSystem:     UnitSystem;
}) {
  // Convert all weight values to display units for charting
  const convertedPoints = points.map((p) => ({
    ...p,
    actual:    p.actual    !== undefined ? kgToDisplay(p.actual,    unitSystem) : undefined,
    projected: p.projected !== undefined ? kgToDisplay(p.projected, unitSystem) : undefined,
  }));
  const targetDisplay = targetWeightKg !== null ? kgToDisplay(targetWeightKg, unitSystem) : null;
  const wl = weightLabel(unitSystem);

  const actuals    = convertedPoints.filter((p) => p.actual    !== undefined).map((p) => p.actual    as number);
  const projValues = convertedPoints.filter((p) => p.projected !== undefined).map((p) => p.projected as number);
  const allValues  = [...actuals, ...projValues, targetDisplay ?? 0].filter(Boolean);

  const yMin = Math.floor(Math.min(...allValues) - 1);
  const yMax = Math.ceil(Math.max(...allValues) + 1);

  // Thin out x-axis labels for small screens
  const labelEvery = Math.ceil(points.length / 5);

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={convertedPoints} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          interval={labelEvery - 1}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [
            `${value} ${wl}`,
            name === "actual" ? "Weight" : "Trend",
          ]}
          labelStyle={{ color: "#a1a1aa" }}
        />

        {targetDisplay !== null && (
          <ReferenceLine
            y={targetDisplay}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Target ${targetDisplay} ${wl}`,
              position: "insideTopRight",
              fill: "#f59e0b",
              fontSize: 10,
            }}
          />
        )}

        {/* Projected trend — dashed, dim */}
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#52525b"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
          activeDot={{ r: 3, fill: "#52525b" }}
        />

        {/* Actual weight — solid lime */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#a3e635"
          strokeWidth={2}
          dot={{ fill: "#a3e635", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#a3e635" }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── body fat chart ───────────────────────────────────────────────────────────

function BfChart({ points }: { points: ProgressData["bfPoints"] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          interval={Math.ceil(points.length / 5) - 1}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value}%`, "Body fat"]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={{ fill: "#60a5fa", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#60a5fa" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── energy chart ─────────────────────────────────────────────────────────────

function EnergyChart({ points }: { points: ProgressData["energyPoints"] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} / 5`, "Ride energy"]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
          {points.map((p, i) => (
            <Cell
              key={i}
              fill={p.avg >= 4 ? "#a3e635" : p.avg >= 3 ? "#f59e0b" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  colour = "text-white",
}: {
  value:   string;
  label:   string;
  sub?:    string;
  colour?: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-4 flex flex-col gap-1">
      <p className={`text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      <p className="text-zinc-400 text-xs font-medium">{label}</p>
      {sub && <p className="text-zinc-600 text-xs">{sub}</p>}
    </div>
  );
}

// ─── section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ProgressView({
  data,
  unitSystem = "metric",
}: {
  data: ProgressData;
  unitSystem?: UnitSystem;
}) {
  // Recharts reads `window` — only render after mount to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { weightPoints, targetWeightKg, projectedDate, slopeKgPerWeek, bfPoints, stats, energyPoints } = data;
  const wl = weightLabel(unitSystem);

  const hasWeight    = weightPoints.some((p) => p.actual !== undefined);
  const hasBf        = bfPoints.length >= 2;
  const hasEnergy    = energyPoints.length >= 1;
  const hasCompliance = stats.daysOnPlan > 0;

  const slopeDisplay = slopeKgPerWeek !== null
    ? kgToDisplay(Math.abs(slopeKgPerWeek), unitSystem)
    : null;
  const slopeLabel = slopeKgPerWeek !== null
    ? slopeKgPerWeek < 0
      ? `${slopeDisplay} ${wl}/week loss`
      : slopeKgPerWeek > 0
        ? `+${slopeDisplay} ${wl}/week gain`
        : "Weight stable"
    : null;

  const chartSkeleton = (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="h-[210px] animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-8">

      {/* ── weight ── */}
      <Section title="Weight">

        {/* Projection callout */}
        {projectedDate && targetWeightKg !== null && (
          <div className="bg-lime-400/10 border border-lime-400/20 rounded-2xl px-4 py-3.5">
            <p className="text-white text-sm font-semibold leading-snug">
              At this rate you&apos;ll hit{" "}
              <span className="text-lime-400">{kgToDisplay(targetWeightKg, unitSystem)} {wl}</span>{" "}
              by{" "}
              <span className="text-lime-400">{projectedDate}</span>
            </p>
            {slopeLabel && (
              <p className="text-zinc-500 text-xs mt-1">{slopeLabel} · keep going</p>
            )}
          </div>
        )}

        {/* Not-on-track state */}
        {!projectedDate && hasWeight && targetWeightKg !== null && slopeKgPerWeek !== null && slopeKgPerWeek >= 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5">
            <p className="text-zinc-400 text-sm font-medium">Not trending toward target yet</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              {slopeKgPerWeek === 0
                ? "Weight is stable — review your calorie plan"
                : "Weight is trending up — check your fuelling plan"}
            </p>
          </div>
        )}

        {/* Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-2 pt-4 pb-2">
          {hasWeight && weightPoints.length >= 2 ? (
            mounted ? (
              <WeightChart points={weightPoints} targetWeightKg={targetWeightKg} unitSystem={unitSystem} />
            ) : chartSkeleton
          ) : (
            <EmptyState
              message={
                hasWeight
                  ? "Log one more weigh-in to see your trend"
                  : "Log your first weigh-in via the daily check-in"
              }
            />
          )}
        </div>

        {/* Weight stat row */}
        {hasWeight && (
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const actuals = weightPoints.filter((p) => p.actual !== undefined);
              const first = actuals[0]?.actual;
              const last  = actuals.at(-1)?.actual;
              const lostKg = first && last ? Math.round((first - last) * 10) / 10 : null;
              const lastDisplay = last ? kgToDisplay(last, unitSystem) : null;
              const lostDisplay = lostKg !== null ? kgToDisplay(Math.abs(lostKg), unitSystem) : null;
              return (
                <>
                  {lastDisplay !== null && (
                    <StatCard
                      value={`${lastDisplay} ${wl}`}
                      label="Current weight"
                      colour="text-white"
                    />
                  )}
                  {lostKg !== null && lostDisplay !== null && (
                    <StatCard
                      value={lostKg > 0 ? `−${lostDisplay} ${wl}` : lostKg < 0 ? `+${lostDisplay} ${wl}` : `0 ${wl}`}
                      label="Total change"
                      sub={`since ${weightPoints[0]?.label}`}
                      colour={lostKg > 0 ? "text-lime-400" : lostKg < 0 ? "text-red-400" : "text-zinc-400"}
                    />
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Section>

      {/* ── body fat ── */}
      {hasBf && (
        <Section title="Body fat %">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-2 pt-4 pb-2">
            {mounted ? (
              <BfChart points={bfPoints} />
            ) : (
              <div className="h-[160px] animate-pulse" />
            )}
          </div>
          {(() => {
            const first = bfPoints[0].value;
            const last  = bfPoints.at(-1)!.value;
            const change = Math.round((last - first) * 10) / 10;
            return (
              <div className="flex items-baseline gap-2 px-1">
                <span className="text-white text-xl font-bold tabular-nums">{last}%</span>
                {change !== 0 && (
                  <span className={`text-sm font-medium ${change < 0 ? "text-lime-400" : "text-red-400"}`}>
                    {change > 0 ? "+" : ""}{change}% since {bfPoints[0].label}
                  </span>
                )}
              </div>
            );
          })()}
        </Section>
      )}

      {/* ── compliance ── */}
      <Section title="Plan adherence">
        {hasCompliance ? (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              value={`${stats.compliancePct}%`}
              label="Compliance"
              colour={stats.compliancePct >= 80 ? "text-lime-400" : stats.compliancePct >= 60 ? "text-amber-400" : "text-zinc-300"}
            />
            <StatCard
              value={`${stats.streak}`}
              label="Day streak"
              sub={stats.streak >= 7 ? "🔥" : undefined}
              colour={stats.streak >= 7 ? "text-lime-400" : "text-white"}
            />
            <StatCard
              value={`${stats.daysOnPlan}`}
              label="Days logged"
              colour="text-white"
            />
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-5 text-center">
            <p className="text-zinc-500 text-sm">Complete your first daily check-in to see adherence stats.</p>
          </div>
        )}
      </Section>

      {/* ── ride energy ── */}
      <Section title="Ride energy">
        {hasEnergy ? (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-2 pt-4 pb-2">
              {mounted ? (
                <EnergyChart points={energyPoints} />
              ) : (
                <div className="h-[160px] animate-pulse" />
              )}
            </div>
            <p className="text-zinc-600 text-xs px-1">
              Weekly average ride energy rating (1–5) from your daily check-ins.
              {energyPoints.length > 0 && (() => {
                const last = energyPoints.at(-1)!.avg;
                if (last >= 4) return " Looking strong lately.";
                if (last >= 3) return " Holding steady.";
                return " Energy low recently — check your pre-ride fuelling.";
              })()}
            </p>
          </>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-5 text-center">
            <p className="text-zinc-500 text-sm">
              Rate your ride energy in the daily check-in to track your trend.
            </p>
          </div>
        )}
      </Section>

    </div>
  );
}
