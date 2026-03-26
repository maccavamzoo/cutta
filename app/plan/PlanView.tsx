"use client";

import { useState } from "react";
import type { DayPlanOutput } from "@/lib/ai/buildPlanPrompt";
import AddEventSheet, { type CalendarEvent } from "./AddEventSheet";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";

// ─── exported types ───────────────────────────────────────────────────────────

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
  scheduledAt: string;   // ISO
  durationMinutes: number | null;
  intensity: string | null;
  notes: string | null;
  roughCalories: number | null;
}

export interface CalorieMeta {
  maintenance: number | null;
  restDayCalories: number | null;
  trainingDayCalories: number | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
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

const TYPE_BADGE: Record<string, string> = {
  training: "bg-lime-400/10 text-lime-400 border border-lime-400/30",
  race:     "bg-orange-400/10 text-orange-400 border border-orange-400/30",
  rest:     "bg-zinc-800 text-zinc-500 border border-zinc-700",
  other:    "bg-zinc-800 text-zinc-500 border border-zinc-700",
};

const INTENSITY_LABEL: Record<string, string> = {
  easy:     "Easy",
  moderate: "Moderate",
  hard:     "Hard",
  race:     "Race pace",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  ride:  "bg-lime-400/10 text-lime-400 border border-lime-400/30",
  race:  "bg-orange-400/10 text-orange-400 border border-orange-400/30",
  rest:  "bg-zinc-800 text-zinc-500 border border-zinc-700",
  other: "bg-zinc-800 text-zinc-500 border border-zinc-700",
};

// ─── sub-components ───────────────────────────────────────────────────────────

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
      {cal     != null && <span className="text-white font-semibold">{cal} kcal</span>}
      {carbs   != null && <span className="text-zinc-500">C <span className="text-zinc-300">{carbs}g</span></span>}
      {protein != null && <span className="text-zinc-500">P <span className="text-zinc-300">{protein}g</span></span>}
      {fat     != null && <span className="text-zinc-500">F <span className="text-zinc-300">{fat}g</span></span>}
    </div>
  );
}

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

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface DayCardProps {
  dateStr:          string;
  isToday:          boolean;
  dayIndex:         number; // 0-9
  plan:             StoredPlan | null;
  events:           PlanCalendarEvent[];
  calorieMeta:      CalorieMeta;
  projectedWeight:  number | null;
  unitSystem:       UnitSystem;
  onEventAdded:     (event: CalendarEvent) => void;
}

function DayCard({
  dateStr,
  isToday,
  dayIndex,
  plan,
  events,
  calorieMeta,
  projectedWeight,
  unitSystem,
  onEventAdded,
}: DayCardProps) {
  const [expanded,    setExpanded]    = useState(isToday);
  const [sheetOpen,   setSheetOpen]   = useState(false);

  const hasPlan      = plan !== null;
  const hasEvents    = events.length > 0;
  const isInPlanZone = dayIndex < 3; // first 3 days have AI meal plans
  const battery      = plan?.glycogenBattery ?? null;

  // Determine day type for border/badge
  const isTrainingDay = events.some((e) => e.eventType === "ride" || e.eventType === "race");
  const isRaceDay     = events.some((e) => e.eventType === "race");
  const dayType       = isRaceDay ? "race" : isTrainingDay ? "training" : "rest";

  const roughCals = isTrainingDay
    ? calorieMeta.trainingDayCalories
    : calorieMeta.restDayCalories;

  const wLabel = weightLabel(unitSystem);
  const projW  = projectedWeight != null
    ? kgToDisplay(projectedWeight, unitSystem)
    : null;

  const borderClass = isToday
    ? "border-lime-400/30"
    : isRaceDay
    ? "border-orange-400/20"
    : isTrainingDay
    ? "border-lime-400/20"
    : "border-zinc-800";

  const bgClass = isToday ? "bg-zinc-900" : "bg-zinc-900/50";

  function handleEventAdded(event: CalendarEvent) {
    setSheetOpen(false);
    onEventAdded(event);
  }

  return (
    <>
      <div className={`rounded-xl border transition-colors ${borderClass} ${bgClass}`}>
        {/* Collapsed header — always visible */}
        <button
          className="w-full px-4 py-3 text-left"
          onClick={() => setExpanded((x) => !x)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {/* Date */}
              <span className={`text-sm font-bold shrink-0 ${isToday ? "text-lime-400" : "text-white"}`}>
                {fmtDay(dateStr)}
                {isToday && <span className="ml-1.5 text-xs font-normal text-lime-600">Today</span>}
              </span>

              {/* Day-type badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${TYPE_BADGE[dayType]}`}>
                {dayType}
              </span>

              {/* Green dot if plan exists */}
              {hasPlan && (
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shrink-0" title="Meal plan ready" />
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Projected weight */}
              {projW != null && (
                <span className="text-zinc-600 text-xs tabular-nums">
                  {projW} {wLabel}
                </span>
              )}
              <span className="text-zinc-700 text-sm">{expanded ? "▲" : "▼"}</span>
            </div>
          </div>

          {/* Activities summary in collapsed view */}
          {hasEvents && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {events.map((ev) => (
                <span key={ev.id} className={`text-xs px-2 py-0.5 rounded-full ${EVENT_TYPE_BADGE[ev.eventType] ?? EVENT_TYPE_BADGE.other}`}>
                  {ev.title}
                  {ev.durationMinutes ? ` · ${ev.durationMinutes}m` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Glycogen battery (plan zone only) */}
          {hasPlan && battery != null && (
            <div className="mt-2">
              <GlyBattery value={battery} />
            </div>
          )}

          {/* Macros summary */}
          {hasPlan && (
            <div className="mt-1.5">
              <MacroRow
                cal={plan.totalCalories}
                carbs={plan.totalCarbsG}
                protein={plan.totalProteinG}
                fat={plan.totalFatG}
              />
            </div>
          )}

          {/* Rough calories for non-plan days */}
          {!hasPlan && roughCals != null && (
            <p className="text-zinc-600 text-xs mt-1 tabular-nums">~{roughCals} kcal target</p>
          )}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-3">

            {/* Activity details */}
            {hasEvents && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Activities</p>
                {events.map((ev) => (
                  <div key={ev.id} className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-white text-sm font-medium">{ev.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${EVENT_TYPE_BADGE[ev.eventType] ?? EVENT_TYPE_BADGE.other}`}>
                        {ev.eventType}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-zinc-500 flex-wrap">
                      {ev.durationMinutes && <span>{ev.durationMinutes} min</span>}
                      {ev.intensity && <span>{INTENSITY_LABEL[ev.intensity] ?? ev.intensity}</span>}
                      {ev.roughCalories && <span className="tabular-nums">~{ev.roughCalories} kcal</span>}
                    </div>
                    {ev.notes && (
                      <p className="text-zinc-600 text-xs mt-1 italic">{ev.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Meal plan (first 3 days) */}
            {isInPlanZone && hasPlan && (
              <>
                {plan.aiReasoning && (
                  <p className="text-zinc-500 text-xs italic leading-relaxed">{plan.aiReasoning}</p>
                )}
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
              </>
            )}

            {/* No plan yet for days 4-10 */}
            {isInPlanZone && !hasPlan && (
              <p className="text-zinc-700 text-xs">Not yet generated</p>
            )}
            {!isInPlanZone && (
              <p className="text-zinc-700 text-xs">No meal plan for this day yet</p>
            )}

            {/* Add activity button */}
            <button
              onClick={() => setSheetOpen(true)}
              className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-600 text-xs hover:border-zinc-500 hover:text-zinc-400 transition-colors"
            >
              + Add activity
            </button>
          </div>
        )}
      </div>

      {sheetOpen && (
        <AddEventSheet
          defaultDate={new Date(dateStr + "T09:00:00")}
          onClose={() => setSheetOpen(false)}
          onAdded={handleEventAdded}
        />
      )}
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PlanView({
  initialPlans,
  calendarEvents,
  calorieMeta,
  todayStr,
  currentWeightKg,
  dailyWeightLossKg,
  unitSystem,
}: {
  initialPlans:      StoredPlan[];
  calendarEvents:    PlanCalendarEvent[];
  calorieMeta:       CalorieMeta;
  todayStr:          string;
  currentWeightKg:   number | null;
  dailyWeightLossKg: number | null;
  unitSystem:        UnitSystem;
}) {
  const [events, setEvents] = useState<PlanCalendarEvent[]>(calendarEvents);
  const [futureSheetOpen, setFutureSheetOpen] = useState(false);

  const plansByDate  = new Map<string, StoredPlan>(initialPlans.map((p) => [p.planDate, p]));
  const eventsByDate = new Map<string, PlanCalendarEvent[]>();
  for (const e of events) {
    const arr = eventsByDate.get(e.scheduledDate) ?? [];
    arr.push(e);
    eventsByDate.set(e.scheduledDate, arr);
  }

  const dates = Array.from({ length: 10 }, (_, i) => addDays(todayStr, i));

  function handleEventAdded(event: CalendarEvent) {
    const dateStr = new Date(event.scheduledAt).toISOString().split("T")[0];
    const newEvent: PlanCalendarEvent = {
      id:              event.id,
      title:           event.title,
      eventType:       event.eventType,
      scheduledDate:   dateStr,
      scheduledAt:     event.scheduledAt,
      durationMinutes: event.durationMinutes,
      intensity:       event.intensity,
      notes:           event.notes,
      roughCalories:   null,
    };
    setEvents((prev) => [...prev, newEvent]);
  }

  function projectedWeight(dayIndex: number): number | null {
    if (currentWeightKg == null || dailyWeightLossKg == null) return null;
    return currentWeightKg - dailyWeightLossKg * dayIndex;
  }

  return (
    <div className="space-y-3">
      {dates.map((dateStr, i) => (
        <DayCard
          key={dateStr}
          dateStr={dateStr}
          isToday={i === 0}
          dayIndex={i}
          plan={plansByDate.get(dateStr) ?? null}
          events={eventsByDate.get(dateStr) ?? []}
          calorieMeta={calorieMeta}
          projectedWeight={projectedWeight(i)}
          unitSystem={unitSystem}
          onEventAdded={handleEventAdded}
        />
      ))}

      {/* Future events button */}
      <button
        onClick={() => setFutureSheetOpen(true)}
        className="w-full py-3 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-sm hover:border-zinc-600 hover:text-zinc-400 transition-colors"
      >
        + Schedule future event (beyond 10 days)
      </button>

      {futureSheetOpen && (
        <AddEventSheet
          defaultDate={(() => {
            const d = new Date(todayStr + "T09:00:00");
            d.setDate(d.getDate() + 11);
            return d;
          })()}
          onClose={() => setFutureSheetOpen(false)}
          onAdded={(event) => {
            setFutureSheetOpen(false);
            // Future events don't show in this view, but they're saved
            void event;
          }}
        />
      )}
    </div>
  );
}
