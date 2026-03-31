"use client";

import { useEffect, useState } from "react";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import {
  ComposedChart,
  Area,
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
    date:       string;
    label:      string;
    dayIndex:   number;
    actual?:    number;
    plan?:      number;
    bandLower?: number;  // aggressive rate weight (bottom of band)
    bandUpper?: number;  // conservative rate weight (top of band)
  }[];
  chartStartDate:  string | null;
  targetWeightKg:  number | null;
  weightLossRate:  string | null;
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

// ─── rate display labels ──────────────────────────────────────────────────────

const RATE_DISPLAY: Record<string, string> = {
  aggressive:   "aggressive (0.875 kg/week)",
  moderate:     "moderate (0.5 kg/week)",
  conservative: "conservative (0.25 kg/week)",
  maintain:     "maintain",
};

// ─── tooltip styles ───────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: "#18181b",
  border:          "1px solid #3f3f46",
  borderRadius:    "10px",
  fontSize:        "12px",
  color:           "#e4e4e7",
};

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-zinc-600 text-sm text-center px-6">{message}</p>
    </div>
  );
}

// ─── weight tooltip ───────────────────────────────────────────────────────────

function WeightTooltip({
  active,
  payload,
  wl,
}: {
  active?:  boolean;
  payload?: { payload: { label?: string; actual?: number; plan?: number } }[];
  wl:       string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const diff =
    d.actual !== undefined && d.plan !== undefined
      ? Math.round((d.actual - d.plan) * 10) / 10
      : null;
  return (
    <div style={tooltipStyle} className="px-3 py-2.5 space-y-1 min-w-[150px]">
      <p className="text-zinc-400 text-xs">{d.label}</p>
      {d.actual !== undefined && (
        <p className="text-white text-xs">
          Weigh-in: <span className="font-semibold">{d.actual} {wl}</span>
        </p>
      )}
      {d.plan !== undefined && (
        <p className="text-zinc-500 text-xs">Plan: {d.plan} {wl}</p>
      )}
      {diff !== null && (
        <p className={`text-xs font-medium ${diff === 0 ? "text-lime-400" : diff > 0 ? "text-red-400" : "text-lime-400"}`}>
          {diff === 0
            ? "On track"
            : diff > 0
            ? `${diff} ${wl} above plan`
            : `${Math.abs(diff)} ${wl} below plan`}
        </p>
      )}
    </div>
  );
}

// ─── weight chart ─────────────────────────────────────────────────────────────

function WeightChart({
  points,
  targetWeightKg,
  unitSystem,
  chartStartDate,
}: {
  points:          ProgressData["weightPoints"];
  targetWeightKg:  number | null;
  unitSystem:      UnitSystem;
  chartStartDate:  string | null;
}) {
  const wl = weightLabel(unitSystem);

  // Convert all weight values to display units
  const convertedPoints = points.map((p) => ({
    ...p,
    actual:    p.actual    !== undefined ? kgToDisplay(p.actual,    unitSystem) : undefined,
    plan:      p.plan      !== undefined ? kgToDisplay(p.plan,      unitSystem) : undefined,
    bandLower: p.bandLower !== undefined ? kgToDisplay(p.bandLower, unitSystem) : undefined,
    bandUpper: p.bandUpper !== undefined ? kgToDisplay(p.bandUpper, unitSystem) : undefined,
  }));

  // Derive bandBottom (transparent base) + bandSize (filled range) for Recharts stacking
  const displayPoints = convertedPoints.map((p) => ({
    ...p,
    bandBottom: p.bandLower,
    bandSize:
      p.bandLower !== undefined && p.bandUpper !== undefined
        ? Math.max(0, Math.round((p.bandUpper - p.bandLower) * 10) / 10)
        : undefined,
  }));

  const targetDisplay = targetWeightKg !== null ? kgToDisplay(targetWeightKg, unitSystem) : null;

  const actuals     = displayPoints.filter((p) => p.actual     !== undefined).map((p) => p.actual!);
  const planVals    = displayPoints.filter((p) => p.plan       !== undefined).map((p) => p.plan!);
  const bandBottoms = displayPoints.filter((p) => p.bandBottom !== undefined).map((p) => p.bandBottom!);
  const bandTops    = displayPoints
    .filter((p) => p.bandBottom !== undefined && p.bandSize !== undefined)
    .map((p) => p.bandBottom! + p.bandSize!);

  const allValues = [
    ...actuals,
    ...planVals,
    ...bandBottoms,
    ...bandTops,
    ...(targetDisplay !== null ? [targetDisplay] : []),
  ].filter((v) => typeof v === "number" && isFinite(v));

  const yMin = allValues.length > 0 ? Math.floor(Math.min(...allValues) - 1) : 0;
  const yMax = allValues.length > 0 ? Math.ceil(Math.max(...allValues)  + 1) : 100;

  // Numeric x-axis: pick 5 tick values evenly spaced across the day range
  const firstDay = convertedPoints[0]?.dayIndex ?? 0;
  const lastDay  = convertedPoints.at(-1)?.dayIndex ?? 0;
  const xTicks   = Array.from({ length: 5 }, (_, i) =>
    Math.round(firstDay + (i / 4) * (lastDay - firstDay))
  );
  const formatXTick = (dayIndex: number): string => {
    if (!chartStartDate) return "";
    const d = new Date(new Date(chartStartDate + "T12:00:00Z").getTime() + dayIndex * 86_400_000);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <>
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={displayPoints} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="dayIndex"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={xTicks}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatXTick}
        />
        <YAxis
          domain={[yMin, yMax]}
          allowDataOverflow={true}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          content={(props) => (
            <WeightTooltip
              active={props.active}
              payload={props.payload as { payload: { label?: string; actual?: number; plan?: number } }[] | undefined}
              wl={wl}
            />
          )}
        />

        {/* Band — stacked transparent base + filled range (back layer) */}
        <Area
          type="monotone"
          stackId="band"
          dataKey="bandBottom"
          fill="transparent"
          stroke="none"
          legendType="none"
          connectNulls
        />
        <Area
          type="monotone"
          stackId="band"
          dataKey="bandSize"
          fill="#a3e635"
          fillOpacity={0.07}
          stroke="none"
          legendType="none"
          connectNulls
        />

        {/* Plan line — dashed zinc */}
        <Line
          type="monotone"
          dataKey="plan"
          stroke="#71717a"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
          activeDot={{ r: 3, fill: "#71717a" }}
        />

        {/* Target reference line */}
        {targetDisplay !== null && (
          <ReferenceLine
            y={targetDisplay}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value:    `Target ${targetDisplay} ${wl}`,
              position: "insideTopRight",
              fill:     "#f59e0b",
              fontSize: 10,
            }}
          />
        )}

        {/* Actual weight — solid lime, dots (front layer) */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#a3e635"
          strokeWidth={2}
          dot={{ fill: "#a3e635", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#a3e635" }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>

    {/* Legend */}
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2 pt-1">
      <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
        <span className="inline-block w-2 h-2 rounded-full bg-[#a3e635]" />
        Weigh-ins
      </span>
      <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
        <svg width="18" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="18" y2="4" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        Your plan
      </span>
      <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
        <span className="inline-block w-4 h-3 rounded-sm bg-[#a3e635]/20 border border-[#a3e635]/30" />
        Possible range
      </span>
      <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
        <svg width="18" height="8" className="shrink-0">
          <line x1="0" y1="4" x2="18" y2="4" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        Target
      </span>
    </div>
    </>
  );
}

// ─── body fat chart ───────────────────────────────────────────────────────────

function BfChart({ points }: { points: ProgressData["bfPoints"] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
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
      </ComposedChart>
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
  data:       ProgressData;
  unitSystem?: UnitSystem;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { weightPoints, chartStartDate, targetWeightKg, weightLossRate, projectedDate, slopeKgPerWeek, bfPoints, stats, energyPoints } = data;
  const wl = weightLabel(unitSystem);

  const hasWeight     = weightPoints.some((p) => p.actual !== undefined);
  const hasBf         = bfPoints.length >= 2;
  const hasEnergy     = energyPoints.length >= 1;
  const hasCompliance = stats.daysOnPlan > 0;

  const slopeDisplay = slopeKgPerWeek !== null
    ? kgToDisplay(Math.abs(slopeKgPerWeek), unitSystem)
    : null;
  const slopeLabel = slopeKgPerWeek !== null && slopeKgPerWeek !== 0
    ? `${slopeDisplay} ${wl}/week loss`
    : null;

  const chartSkeleton = (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="h-[220px] animate-pulse" />
    </div>
  );

  const showNotOnTrack =
    !projectedDate &&
    hasWeight &&
    targetWeightKg !== null &&
    weightLossRate !== null &&
    weightLossRate !== "maintain";

  return (
    <div className="space-y-8">

      {/* ── weight ── */}
      <Section title="Weight">

        {/* Projection callout */}
        {projectedDate && targetWeightKg !== null && (
          <div className="bg-lime-400/10 border border-lime-400/20 rounded-2xl px-4 py-3.5">
            <p className="text-white text-sm font-semibold leading-snug">
              At this rate you&apos;ll hit{" "}
              <span className="text-lime-400">{kgToDisplay(targetWeightKg, unitSystem).toFixed(1)} {wl}</span>{" "}
              by{" "}
              <span className="text-lime-400">{projectedDate}</span>
              {weightLossRate && RATE_DISPLAY[weightLossRate] && (
                <span className="text-zinc-400 font-normal"> · {RATE_DISPLAY[weightLossRate]}</span>
              )}
            </p>
            {slopeLabel && (
              <p className="text-zinc-500 text-xs mt-1">{slopeLabel} · keep going</p>
            )}
          </div>
        )}

        {/* Not-on-track state */}
        {showNotOnTrack && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5">
            <p className="text-zinc-400 text-sm font-medium">Not trending toward target yet</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Log more weigh-ins so Cutta can calculate your trajectory.
            </p>
          </div>
        )}

        {/* Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-2 pt-4 pb-2">
          {hasWeight ? (
            mounted ? (
              <WeightChart points={weightPoints} targetWeightKg={targetWeightKg} unitSystem={unitSystem} chartStartDate={chartStartDate} />
            ) : chartSkeleton
          ) : (
            <EmptyState message="Log your first weigh-in via the daily check-in" />
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
                      value={`${lastDisplay.toFixed(1)} ${wl}`}
                      label="Current weight"
                      colour="text-white"
                    />
                  )}
                  {lostKg !== null && lostDisplay !== null && (
                    <StatCard
                      value={lostKg > 0 ? `−${lostDisplay.toFixed(1)} ${wl}` : lostKg < 0 ? `+${lostDisplay.toFixed(1)} ${wl}` : `0 ${wl}`}
                      label="Total change"
                      sub={`since ${actuals[0]?.label ?? weightPoints[0]?.label}`}
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
            const first  = bfPoints[0].value;
            const last   = bfPoints.at(-1)!.value;
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
