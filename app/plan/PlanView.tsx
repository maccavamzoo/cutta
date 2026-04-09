"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DayPlanOutput } from "@/lib/ai/buildDayPlanPrompt";
import AddEventSheet, { type CalendarEvent, type ActivityTypeOption } from "./AddEventSheet";
import EditEventSheet, { type EditableEvent } from "@/components/EditEventSheet";
import type { UnitSystem } from "@/lib/units";
import { kgToDisplay, weightLabel } from "@/lib/units";

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
  notes: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// Hardcoded arrays — immune to ICU version differences between Node.js and Chrome
const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function calorieBorder(cal: number | null): string {
  if (cal == null || cal < 1800) return "border-zinc-800";
  if (cal < 2300) return "border-zinc-600/50";
  if (cal < 2800) return "border-lime-400/25";
  if (cal < 3300) return "border-amber-400/30";
  return "border-orange-400/40";
}

function getEventBadgeClass(eventType: string): string {
  if (eventType === "rest") return "bg-zinc-800 text-zinc-500 border border-zinc-700";
  if (eventType.toLowerCase().includes("race")) return "bg-orange-400/10 text-orange-400 border border-orange-400/30";
  return "bg-lime-400/10 text-lime-400 border border-lime-400/30";
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
  plan:             StoredPlan | null;
  events:           PlanCalendarEvent[];
  isGenerating:     boolean;
  isStale:          boolean;
  hasActiveProtocol: boolean;
  unitSystem:       UnitSystem;
  activityTypes:    ActivityTypeOption[];
  timezone:         string;
  onGenerate:       () => void;
  onEventAdded:     (event: CalendarEvent) => void;
  onEventUpdated:   (event: EditableEvent) => void;
  onEventDeleted:   (id: number) => void;
}

function DayCard({
  dateStr,
  isToday,
  plan,
  events,
  isGenerating,
  isStale,
  hasActiveProtocol,
  activityTypes,
  timezone,
  onGenerate,
  onEventAdded,
  onEventUpdated,
  onEventDeleted,
}: DayCardProps) {
  const [expanded,     setExpanded]     = useState(false);
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);

  const hasPlan   = plan !== null;
  const hasEvents = events.length > 0;

  return (
    <>
      <div data-date={dateStr} className={`rounded-xl border transition-all ${isGenerating ? "border-lime-400/30 bg-zinc-900 shadow-[0_0_20px_rgba(163,230,53,0.08)]" : `${calorieBorder(plan?.totalCalories ?? null)} ${isToday ? "bg-zinc-900" : "bg-zinc-900/50"}`}`}>

        {/* Header row — tap to expand/collapse */}
        <button className="w-full px-4 py-3 text-left" onClick={() => setExpanded((x) => !x)}>
          <div className="flex items-start justify-between gap-2">

            {/* Left: date, status, chips, macros */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold shrink-0 ${isToday ? "text-lime-400" : "text-white"}`}>
                  {fmtDay(dateStr)}
                  {isToday && <span className="ml-1.5 text-xs font-normal text-lime-600">Today</span>}
                </span>
                {hasPlan && !isStale && (
                  <span className="text-xs text-lime-600 shrink-0">Plan ready</span>
                )}
                {!hasPlan && !isGenerating && (
                  <span className="text-xs text-zinc-600 shrink-0">No plan</span>
                )}
              </div>

              {/* Activity chips or Rest day */}
              <div className="mt-1.5 flex flex-col gap-1">
                {hasEvents
                  ? events.map((ev) => {
                      const time  = new Date(ev.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
                      const parts = [ev.eventType, ev.title, ev.durationMinutes ? `${ev.durationMinutes}m` : null, time]
                        .filter(Boolean).join(" · ");
                      return (
                        <span key={ev.id} className={`text-xs px-2 py-0.5 rounded-full self-start ${getEventBadgeClass(ev.eventType)}`}>
                          {parts}
                        </span>
                      );
                    })
                  : (
                    <span className="text-xs px-2 py-0.5 rounded-full self-start bg-zinc-800 text-zinc-500 border border-zinc-700">
                      Rest day
                    </span>
                  )
                }
              </div>

              {/* Macro summary */}
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
            </div>

            {/* Right: generate button + arrow */}
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isGenerating && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin text-lime-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-20" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span className="text-lime-400 text-sm font-medium animate-pulse">Generating…</span>
                </div>
              )}
              {!isGenerating && !hasPlan && hasActiveProtocol && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  className="bg-lime-400 text-black text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-lime-300 transition-colors"
                >
                  Generate
                </button>
              )}
              {!isGenerating && hasPlan && isStale && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  className="bg-amber-400/15 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-400/30 hover:bg-amber-400/25 transition-colors"
                >
                  Regenerate
                </button>
              )}
              <span className="text-zinc-700 text-sm">{expanded ? "▼" : "▲"}</span>
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-3">

            {/* Activity details */}
            {hasEvents && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Activities</p>
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setEditingEvent(ev)}
                    className="w-full text-left bg-zinc-800/50 rounded-lg px-3 py-2.5 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-white text-sm font-medium">{ev.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getEventBadgeClass(ev.eventType)}`}>
                          {ev.eventType}
                        </span>
                        <span className="text-zinc-600 text-xs">Edit →</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-zinc-500 flex-wrap">
                      {ev.durationMinutes && <span>{ev.durationMinutes} min</span>}
                    </div>
                    {ev.notes && <p className="text-zinc-600 text-xs mt-1 italic">{ev.notes}</p>}
                  </button>
                ))}
              </div>
            )}

            {/* Meal plan */}
            {hasPlan && (
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

            {/* Subtle regenerate when plan is up-to-date */}
            {hasPlan && !isStale && !isGenerating && (
              <button
                onClick={() => onGenerate()}
                className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors"
              >
                Regenerate
              </button>
            )}

            {/* Add activity */}
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
          activityTypes={activityTypes}
          onClose={() => setSheetOpen(false)}
          onAdded={(event) => { setSheetOpen(false); onEventAdded(event); }}
        />
      )}

      {editingEvent && (
        <EditEventSheet
          event={editingEvent}
          activityTypes={activityTypes}
          onClose={() => setEditingEvent(null)}
          onUpdated={(updated) => { setEditingEvent(null); onEventUpdated(updated); }}
          onDeleted={(id) => { setEditingEvent(null); onEventDeleted(id); }}
        />
      )}
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PlanView({
  initialPlans,
  calendarEvents,
  todayStr,
  unitSystem,
  hasActiveProtocol,
  hasWeeklyStrategy,
  dataLastChangedAt,
  activityTypes,
  protocolName,
  targetWeightKg,
  arrivalStr,
  timezone,
}: {
  initialPlans:      StoredPlan[];
  calendarEvents:    PlanCalendarEvent[];
  todayStr:          string;
  unitSystem:        UnitSystem;
  hasActiveProtocol: boolean;
  hasWeeklyStrategy: boolean;
  dataLastChangedAt: string | null;
  activityTypes:     ActivityTypeOption[];
  protocolName:      string | null;
  targetWeightKg:    number | null;
  arrivalStr:        string | null;
  timezone:          string;
}) {
  const router = useRouter();

  const inspectMode = true; // set to false to re-enable real generation

  const [plans, setPlans] = useState<Map<string, StoredPlan>>(
    () => new Map(initialPlans.map((p) => [p.planDate, p]))
  );
  const [events, setEvents] = useState<PlanCalendarEvent[]>(calendarEvents);
  const [generatingDates, setGeneratingDates] = useState<Set<string>>(new Set());
  const [lastDataChange, setLastDataChange] = useState<string | null>(dataLastChangedAt);
  const [inspectPrompt, setInspectPrompt] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i));

  // ── Per-day generation ───────────────────────────────────────────────────

  async function handleGenerate(dateStr: string) {
    if (inspectMode) {
      setInspecting(true);
      setGeneratingDates((prev) => new Set(prev).add(dateStr));
      try {
        const res = await fetch("/api/fuelling-plan/inspect-prompt", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ date: dateStr }),
        });
        if (res.ok) {
          const data = await res.json() as { prompt: string };
          setInspectPrompt(data.prompt);
        }
      } finally {
        setGeneratingDates((prev) => {
          const next = new Set(prev);
          next.delete(dateStr);
          return next;
        });
        setInspecting(false);
      }
      return;
    }

    setGeneratingDates((prev) => new Set(prev).add(dateStr));
    try {
      const res = await fetch("/api/fuelling-plan/generate-day", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date: dateStr }),
      });
      if (res.ok) {
        const data = await res.json() as { plan: StoredPlan };
        setPlans((prev) => {
          const next = new Map(prev);
          next.set(dateStr, data.plan);
          return next;
        });
      }
    } finally {
      setGeneratingDates((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
      router.refresh();
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  function handleEventAdded(event: CalendarEvent) {
    const dateStr = new Date(event.scheduledAt).toISOString().split("T")[0];
    setEvents((prev) => [
      ...prev,
      {
        id:              event.id,
        title:           event.title,
        eventType:       event.eventType,
        scheduledDate:   dateStr,
        scheduledAt:     event.scheduledAt,
        durationMinutes: event.durationMinutes,
        notes:           event.notes,
      },
    ]);
    setLastDataChange(new Date().toISOString());
  }

  function handleEventUpdated(updated: EditableEvent) {
    const dateStr = new Date(updated.scheduledAt).toISOString().split("T")[0];
    setEvents((prev) =>
      prev.map((e) =>
        e.id === updated.id
          ? { ...e, title: updated.title, eventType: updated.eventType, scheduledDate: dateStr,
              scheduledAt: updated.scheduledAt, durationMinutes: updated.durationMinutes,
              notes: updated.notes }
          : e
      )
    );
    setLastDataChange(new Date().toISOString());
  }

  function handleEventDeleted(id: number) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setLastDataChange(new Date().toISOString());
  }

  // ── Per-day staleness ────────────────────────────────────────────────────

  function isStale(plan: StoredPlan): boolean {
    if (!lastDataChange) return false;
    return new Date(plan.generatedAt) < new Date(lastDataChange);
  }

  // ── Event grouping ───────────────────────────────────────────────────────

  const eventsByDate = new Map<string, PlanCalendarEvent[]>();
  for (const e of events) {
    const arr = eventsByDate.get(e.scheduledDate) ?? [];
    arr.push(e);
    eventsByDate.set(e.scheduledDate, arr);
  }

  return (
    <div className="space-y-3">

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">Plan</h1>
        {targetWeightKg != null && arrivalStr && (
          <p className="text-zinc-500 text-sm mt-1">
            Target {kgToDisplay(targetWeightKg, unitSystem).toFixed(1)}{weightLabel(unitSystem)} · est. arrival {arrivalStr}
          </p>
        )}
        {hasActiveProtocol && protocolName && (
          <p className="text-zinc-600 text-xs mt-1">
            <span className="inline-block px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full">
              {protocolName}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push("/calendar")}
          className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors mt-1"
        >
          Monthly view →
        </button>
      </div>

      {/* No active protocol — full empty state, no day cards */}
      {!hasActiveProtocol && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-3">
          <p className="text-zinc-400 text-lg font-semibold">No protocol set</p>
          <p className="text-zinc-600 text-sm leading-relaxed max-w-xs">
            Select a fuelling protocol to start generating your plan.
          </p>
          <Link
            href="/settings/protocol"
            className="mt-2 inline-block px-5 py-2.5 bg-lime-400 text-black text-sm font-semibold rounded-full hover:bg-lime-300 transition-colors"
          >
            Set up protocol →
          </Link>
        </div>
      )}

      {hasActiveProtocol && (
        <>
          {/* No weekly strategy prompt */}
          {!hasWeeklyStrategy && (
            <Link
              href="/shopping"
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
            >
              <p className="text-zinc-500 text-sm">No weekly shopping strategy set</p>
              <span className="text-zinc-600 text-sm shrink-0">Set one →</span>
            </Link>
          )}

          {/* Day cards */}
          {dates.map((dateStr, i) => {
            const plan = plans.get(dateStr) ?? null;
            return (
              <DayCard
                key={dateStr}
                dateStr={dateStr}
                isToday={i === 0}
                plan={plan}
                events={eventsByDate.get(dateStr) ?? []}
                isGenerating={generatingDates.has(dateStr)}
                isStale={plan !== null && isStale(plan)}
                hasActiveProtocol={hasActiveProtocol}
                unitSystem={unitSystem}
                activityTypes={activityTypes}
                timezone={timezone}
                onGenerate={() => handleGenerate(dateStr)}
                onEventAdded={handleEventAdded}
                onEventUpdated={handleEventUpdated}
                onEventDeleted={handleEventDeleted}
              />
            );
          })}
        </>
      )}

      {/* Prompt Inspector modal */}
      {inspectPrompt !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
            <span className="text-white text-sm font-semibold">Prompt Inspector</span>
            <button
              onClick={() => setInspectPrompt(null)}
              className="text-zinc-400 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <pre className="flex-1 overflow-y-auto text-xs text-zinc-300 whitespace-pre-wrap font-mono px-4 py-4">
            {inspectPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
