"use client";

import { useState } from "react";
import type { DayPlanOutput } from "@/lib/ai/buildPlanPrompt";

const WINDOW_DAYS = 14;
const BATCH_SIZE  = 3;

// ─── exported types (consumed by page.tsx) ───────────────────────────────────

export interface StoredPlan {
  id: number;
  planDate: string;
  calendarEventId: number | null;
  meals: DayPlanOutput["meals"];
  onBikeFuelling: DayPlanOutput["on_bike_fuelling"];
  supplements: DayPlanOutput["supplements"];
  totalCalories: number | null;
  totalCarbsG: number | null;
  totalProteinG: number | null;
  totalFatG: number | null;
  aiReasoning: string | null;
  glycogenBattery: number | null;
  generatedAt: string;
}

export interface PlanCalendarEvent {
  id: number;
  title: string;
  eventType: string;
  scheduledDate: string; // YYYY-MM-DD
  durationMinutes: number | null;
  intensity: string | null;
  roughCalories: number | null;
}

export interface CalorieMeta {
  maintenance: number | null;
  restDayCalories: number | null;
  trainingDayCalories: number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function batteryColour(v: number): string {
  if (v >= 70) return "bg-lime-400";
  if (v >= 40) return "bg-amber-400";
  return "bg-red-500";
}

function batteryTextColour(v: number): string {
  if (v >= 70) return "text-lime-400";
  if (v >= 40) return "text-amber-400";
  return "text-red-400";
}

function batteryLabel(v: number): string {
  if (v >= 80) return "Loaded";
  if (v >= 60) return "Good";
  if (v >= 40) return "Moderate";
  if (v >= 20) return "Low";
  return "Depleted";
}

const TYPE_BORDER: Record<string, string> = {
  training: "border-lime-400/30",
  race:     "border-orange-400/30",
  rest:     "border-zinc-700",
};

const TYPE_BADGE: Record<string, string> = {
  training: "bg-lime-400/10 text-lime-400 border border-lime-400/30",
  race:     "bg-orange-400/10 text-orange-400 border border-orange-400/30",
  rest:     "bg-zinc-800 text-zinc-500 border border-zinc-700",
};

const INTENSITY_LABEL: Record<string, string> = {
  easy:     "Easy",
  moderate: "Moderate",
  hard:     "Hard",
  race:     "Race pace",
};

// ─── sub-components: full plan card ──────────────────────────────────────────

function GlyBattery({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${batteryColour(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums w-20 text-right ${batteryTextColour(value)}`}>
        {batteryLabel(value)} {value}%
      </span>
    </div>
  );
}

function MacroRow({ cal, carbs, protein, fat }: {
  cal: number | null; carbs: number | null; protein: number | null; fat: number | null;
}) {
  return (
    <div className="flex gap-3 text-xs tabular-nums flex-wrap">
      {cal    != null && <span className="text-white font-semibold">{cal} kcal</span>}
      {carbs  != null && <span className="text-zinc-500">C <span className="text-zinc-300">{carbs}g</span></span>}
      {protein != null && <span className="text-zinc-500">P <span className="text-zinc-300">{protein}g</span></span>}
      {fat    != null && <span className="text-zinc-500">F <span className="text-zinc-300">{fat}g</span></span>}
    </div>
  );
}

// Same index-based palette as DailyDashboard — must stay in sync
const MEAL_PALETTE = [
  { bar: "border-l-amber-400",  label: "text-amber-400"  },
  { bar: "border-l-sky-400",    label: "text-sky-400"    },
  { bar: "border-l-violet-400", label: "text-violet-400" },
  { bar: "border-l-lime-400",   label: "text-lime-400"   },
  { bar: "border-l-orange-400", label: "text-orange-400" },
] as const;

function MealCard({ meal, index }: { meal: DayPlanOutput["meals"][number]; index: number }) {
  const accent = MEAL_PALETTE[index % MEAL_PALETTE.length];
  return (
    <div className={`bg-zinc-800/50 rounded-lg px-3 py-2.5 border-l-2 ${accent.bar}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="text-white text-sm font-medium">{meal.name}</p>
        <span className={`text-xs shrink-0 ${accent.label}`}>{meal.timing}</span>
      </div>
      <ul className="space-y-0.5">
        {meal.ingredients.map((ing, i) => (
          <li key={i} className="flex justify-between text-xs text-zinc-400">
            <span>{ing.item}</span>
            <span className="text-zinc-600 tabular-nums">{ing.grams}g</span>
          </li>
        ))}
      </ul>
      {meal.cooking_note && (
        <p className="mt-2 text-xs text-zinc-600 italic leading-relaxed border-t border-zinc-700/40 pt-1.5">
          {meal.cooking_note}
        </p>
      )}
    </div>
  );
}

function OnBikeCard({ fuelling }: { fuelling: NonNullable<DayPlanOutput["on_bike_fuelling"]> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">On-bike fuelling</p>
      <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
        <div className="flex justify-between mb-1">
          <p className="text-white text-xs font-semibold">Pre-ride</p>
          <span className="text-zinc-600 text-xs">{fuelling.pre.timing}</span>
        </div>
        <p className="text-zinc-400 text-xs mb-1">{fuelling.pre.description}</p>
        {fuelling.pre.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-500">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>
      <div className="bg-lime-400/5 border border-lime-400/20 rounded-lg px-3 py-2.5">
        <div className="flex justify-between mb-1">
          <p className="text-lime-400 text-xs font-semibold">On bike</p>
          <span className="text-lime-600 text-xs tabular-nums">{fuelling.on_bike.carbs_per_hour}g carbs/hr</span>
        </div>
        {fuelling.on_bike.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-400">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>
      <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
        <div className="flex justify-between mb-1">
          <p className="text-white text-xs font-semibold">Post-ride</p>
          <span className="text-zinc-600 text-xs">{fuelling.post.timing}</span>
        </div>
        <p className="text-zinc-400 text-xs mb-1">{fuelling.post.description}</p>
        {fuelling.post.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-500">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FullDayCard({ plan, isToday }: { plan: StoredPlan; isToday: boolean }) {
  const [expanded, setExpanded] = useState(isToday);
  const battery = plan.glycogenBattery ?? 50;
  const dayType = plan.onBikeFuelling ? "training" : "rest";

  return (
    <div className={`rounded-xl border transition-colors ${
      isToday ? "border-lime-400/30 bg-zinc-900" : "border-zinc-800 bg-zinc-900/50"
    }`}>
      <button className="w-full px-4 py-3 text-left" onClick={() => setExpanded((x) => !x)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${isToday ? "text-lime-400" : "text-white"}`}>
              {fmtDay(plan.planDate)}
              {isToday && <span className="ml-1.5 text-xs font-normal text-lime-600">Today</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[dayType]}`}>
              {dayType}
            </span>
          </div>
          <span className="text-zinc-700 text-sm shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
        <GlyBattery value={battery} />
        {plan.aiReasoning && (
          <p className="text-zinc-500 text-xs italic mt-2 leading-relaxed">{plan.aiReasoning}</p>
        )}
        <div className="mt-2">
          <MacroRow cal={plan.totalCalories} carbs={plan.totalCarbsG} protein={plan.totalProteinG} fat={plan.totalFatG} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-3">
          {plan.meals?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Meals</p>
              {plan.meals.map((meal, i) => <MealCard key={i} meal={meal} index={i} />)}
            </div>
          )}
          {plan.onBikeFuelling && <OnBikeCard fuelling={plan.onBikeFuelling} />}
          {plan.supplements?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Supplements</p>
              {plan.supplements.map((s, i) => (
                <div key={i} className="flex items-baseline justify-between text-xs">
                  <span className="text-zinc-300">{s.name} <span className="text-zinc-600">{s.dose}</span></span>
                  <span className="text-zinc-600">{s.timing}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── sub-component: shell card (ungenerated day) ──────────────────────────────

function ShellCard({
  dateStr,
  isToday,
  event,
  calorieMeta,
}: {
  dateStr: string;
  isToday: boolean;
  event: PlanCalendarEvent | null;
  calorieMeta: CalorieMeta;
}) {
  const isTraining = event && (event.eventType === "ride" || event.eventType === "race");
  const dayType: "training" | "race" | "rest" = event?.eventType === "race"
    ? "race"
    : isTraining
    ? "training"
    : "rest";

  const roughCals = event?.roughCalories
    ?? (isTraining ? calorieMeta.trainingDayCalories : calorieMeta.restDayCalories);

  return (
    <div className={`rounded-xl border ${TYPE_BORDER[dayType]} bg-zinc-900/30`}>
      <div className="px-4 py-3 space-y-2">
        {/* Date + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isToday ? "text-lime-400" : "text-zinc-400"}`}>
              {fmtDay(dateStr)}
              {isToday && <span className="ml-1.5 text-xs font-normal text-lime-600">Today</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[dayType]}`}>
              {dayType}
            </span>
          </div>
          {roughCals && (
            <span className="text-zinc-600 text-xs tabular-nums">~{roughCals} kcal</span>
          )}
        </div>

        {/* Training session info */}
        {event && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 text-xs font-medium">{event.title}</span>
            {event.durationMinutes && (
              <span className="text-zinc-600 text-xs">{event.durationMinutes}m</span>
            )}
            {event.intensity && (
              <span className="text-zinc-600 text-xs">
                {INTENSITY_LABEL[event.intensity] ?? event.intensity}
              </span>
            )}
          </div>
        )}

        {/* No-plan indicator */}
        <p className="text-zinc-700 text-xs">
          Plan not yet generated — use the button above
        </p>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PlanView({
  initialPlans,
  calendarEvents,
  calorieMeta,
  todayStr,
  planStale,
}: {
  initialPlans: StoredPlan[];
  calendarEvents: PlanCalendarEvent[];
  calorieMeta: CalorieMeta;
  todayStr: string;
  planStale: boolean;
}) {
  const [plans]            = useState<StoredPlan[]>(initialPlans);
  const [generating,   setGenerating]   = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [status,       setStatus]       = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [staleDismissed, setStaleDismissed] = useState(false);

  const busy = generating || regenerating;

  // Build index structures
  const plansByDate = new Map<string, StoredPlan>(plans.map((p) => [p.planDate, p]));
  const eventsByDate = new Map<string, PlanCalendarEvent>(
    calendarEvents.map((e) => [e.scheduledDate, e])
  );

  // Build the 14-day window
  const allDates: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    allDates.push(addDays(todayStr, i));
  }

  // Find the next start date for generation (first ungenerated date in window)
  const nextStartDate = allDates.find((d) => !plansByDate.has(d)) ?? null;

  // Show regenerate button when today's 3-day window is already at least partially planned
  const todayWindowEnd = addDays(todayStr, BATCH_SIZE - 1);
  const hasCurrentWindow = allDates
    .slice(0, BATCH_SIZE)
    .some((d) => plansByDate.has(d));

  // Label for the extend button
  const extendLabel = (() => {
    if (!nextStartDate) return "All planned";
    const end = addDays(nextStartDate, BATCH_SIZE - 1);
    return plans.length === 0
      ? `Generate ${fmtShortDate(nextStartDate)}–${fmtShortDate(end)}`
      : `Generate next 3 days (${fmtShortDate(nextStartDate)}–${fmtShortDate(end)})`;
  })();

  const canExtend = !!nextStartDate && !busy;

  async function doGenerate(startDate: string, label: string) {
    setError(null);
    setStatus(`Generating ${label}…`);

    let res: Response;
    try {
      res = await fetch("/api/fuelling-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
    } catch (networkErr) {
      setError(`Network error — could not reach the server. ${networkErr instanceof Error ? networkErr.message : ""}`);
      setStatus(null);
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      setError(`Server error (${res.status}). Check server logs — ANTHROPIC_API_KEY may not be set in .env.local.`);
      setStatus(null);
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? `Generation failed (${res.status}).`);
      setStatus(null);
      return;
    }

    const msg = `Saved ${data.generated} day${data.generated !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.`;
    setStatus(msg);
    setTimeout(() => window.location.reload(), 800);
  }

  async function handleExtend() {
    if (!nextStartDate || busy) return;
    setGenerating(true);
    const end = addDays(nextStartDate, BATCH_SIZE - 1);
    await doGenerate(nextStartDate, `${fmtShortDate(nextStartDate)}–${fmtShortDate(end)}`);
    setGenerating(false);
  }

  async function handleRegenerate() {
    if (busy) return;
    setRegenerating(true);
    await doGenerate(todayStr, `${fmtShortDate(todayStr)}–${fmtShortDate(todayWindowEnd)}`);
    setRegenerating(false);
  }

  const lastGenerated = plans.length > 0
    ? new Date(plans[0].generatedAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-4">

      {/* Stale-plan banner */}
      {planStale && !staleDismissed && !busy && (
        <div className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl px-4 py-3.5">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 text-sm font-semibold">Plan may be out of date</p>
            <p className="text-amber-400/70 text-xs mt-0.5 leading-snug">
              Training, profile, or protocol changed since this was generated.
            </p>
            <div className="flex gap-2 mt-2.5">
              {hasCurrentWindow && (
                <button
                  onClick={() => { setStaleDismissed(true); handleRegenerate(); }}
                  className="px-3 py-1.5 bg-amber-400 text-black text-xs font-semibold rounded-full hover:bg-amber-300 transition-colors"
                >
                  Regenerate now
                </button>
              )}
              <button
                onClick={() => setStaleDismissed(true)}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full hover:bg-zinc-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-2">
        {/* Meta line */}
        {!busy && (
          <div className="flex items-center justify-between min-h-[1.25rem]">
            <div className="space-y-0.5">
              {lastGenerated && (
                <p className="text-zinc-600 text-xs">Last generated {lastGenerated}</p>
              )}
              {plans.length > 0 && (
                <p className="text-zinc-600 text-xs">{plans.length}/{WINDOW_DAYS} days planned</p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Loading state — shown when generating */}
        {busy ? (
          <div className="bg-zinc-900 border border-lime-400/20 rounded-2xl px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-white font-semibold">Building your plan…</p>
              <p className="text-zinc-500 text-sm mt-1">This takes 20–30 seconds — hang tight</p>
            </div>
            {status && <p className="text-zinc-400 text-xs">{status}</p>}
          </div>
        ) : (
          /* Button row */
          <div className="flex gap-2 flex-wrap">
            {hasCurrentWindow && (
              <button
                onClick={handleRegenerate}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white active:bg-zinc-700"
              >
                ↺ Regenerate {fmtShortDate(todayStr)}–{fmtShortDate(todayWindowEnd)}
              </button>
            )}

            <button
              onClick={handleExtend}
              disabled={!canExtend}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                !canExtend
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-lime-400 text-black hover:bg-lime-300 active:bg-lime-500"
              }`}
            >
              {extendLabel}
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {plans.length === 0 && (
        <div className="py-10 text-center space-y-2">
          <p className="text-zinc-500 text-sm font-medium">No plan yet</p>
          <p className="text-zinc-700 text-xs max-w-56 mx-auto leading-relaxed">
            Generate {BATCH_SIZE} days at a time. Extend when you&apos;re ready.
          </p>
        </div>
      )}

      {/* 14-day list */}
      <div className={`space-y-2.5 transition-opacity ${busy ? "opacity-30 pointer-events-none" : ""}`}>
        {allDates.map((dateStr) => {
          const plan  = plansByDate.get(dateStr);
          const event = eventsByDate.get(dateStr) ?? null;
          const isToday = dateStr === todayStr;

          if (plan) {
            return <FullDayCard key={dateStr} plan={plan} isToday={isToday} />;
          }

          return (
            <ShellCard
              key={dateStr}
              dateStr={dateStr}
              isToday={isToday}
              event={event}
              calorieMeta={calorieMeta}
            />
          );
        })}
      </div>
    </div>
  );
}
