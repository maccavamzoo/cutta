"use client";

import { useState } from "react";
import Link from "next/link";
import type { DayPlanOutput } from "@/lib/ai/buildPlanPrompt";
import BottomNav from "@/components/BottomNav";
import CheckInSheet, { type ExistingCheckIn } from "./CheckInSheet";
import WeighInSheet from "./WeighInSheet";
import EditEventSheet, { type EditableEvent } from "@/components/EditEventSheet";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";

// ─── exported types (used by page.tsx) ───────────────────────────────────────

export interface TodayPlan {
  meals:           DayPlanOutput["meals"];
  onBikeFuelling:  DayPlanOutput["on_bike_fuelling"];
  supplements:     DayPlanOutput["supplements"];
  totalCalories:   number | null;
  totalCarbsG:     number | null;
  totalProteinG:   number | null;
  totalFatG:       number | null;
  aiReasoning:     string | null;
  glycogenBattery: number | null;
}

export interface TodayEvent {
  id:              number;
  title:           string;
  eventType:       string;
  scheduledAt:     string;
  durationMinutes: number | null;
  intensity:       string | null;
  notes:           string | null;
}

export interface ProfileSnapshot {
  currentWeightKg:     number | null;
  targetWeightKg:      number | null;
  maintenanceCalories: number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getLocalTime(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).format(new Date());
}

function greeting(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour:     "numeric",
    hour12:   false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtLongDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── glycogen battery ─────────────────────────────────────────────────────────

function BatterySVG({ value, color }: { value: number; color: string }) {
  const bodyW = 220, bodyH = 46;
  const capW = 10, capH = 20;
  const pad = 5;
  const fillW = Math.max(0, (value / 100) * (bodyW - pad * 2));

  return (
    <svg
      viewBox={`0 0 ${bodyW + capW + 4} ${bodyH}`}
      width="100%"
      aria-hidden="true"
    >
      {/* Body outline */}
      <rect
        x={0} y={0} width={bodyW} height={bodyH}
        rx={8} fill="none" stroke={color} strokeWidth={2} opacity={0.3}
      />
      {/* Terminal cap */}
      <rect
        x={bodyW + 4} y={(bodyH - capH) / 2}
        width={capW} height={capH}
        rx={3} fill={color} opacity={0.45}
      />
      {/* Fill */}
      {value > 0 && (
        <rect
          x={pad} y={pad}
          width={fillW} height={bodyH - pad * 2}
          rx={4} fill={color} opacity={0.85}
        />
      )}
    </svg>
  );
}

function GlyBattery({
  value,
  todayStr,
  onCalibrate,
}: {
  value: number;
  todayStr: string;
  onCalibrate?: (val: number) => void;
}) {
  const [showInfo,      setShowInfo]      = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [calibrating,   setCalibrating]   = useState(false);

  const scheme =
    value >= 70
      ? { hex: "#a3e635", text: "text-lime-400",  card: "border-lime-400/20 bg-lime-400/5"   }
      : value >= 40
      ? { hex: "#f59e0b", text: "text-amber-400", card: "border-amber-400/20 bg-amber-400/5" }
      : { hex: "#ef4444", text: "text-red-400",   card: "border-red-500/20 bg-red-500/5"     };

  const message =
    value >= 70 ? "Ready for a hard session" :
    value >= 40 ? "Enough for moderate effort" :
                  "Low — refuel before training";

  async function calibrate(target: number) {
    if (calibrating) return;
    setCalibrating(true);
    try {
      const res = await fetch("/api/fuelling-plan/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDate: todayStr, glycogenBattery: target }),
      });
      if (res.ok) {
        onCalibrate?.(target);
        setShowCalibrate(false);
      }
    } finally {
      setCalibrating(false);
    }
  }

  return (
    <div className={`rounded-2xl border px-5 py-4 space-y-3 ${scheme.card}`}>
      {/* Title + % */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
            Approx. Glycogen
          </span>
          {/* Info icon — inline SVG for reliable rendering */}
          <button
            onClick={() => { setShowInfo((x) => !x); setShowCalibrate(false); }}
            className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label="What is glycogen?"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 6.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="7" cy="4.25" r="0.8" fill="currentColor" />
            </svg>
          </button>
        </div>
        <span className={`text-3xl font-bold tabular-nums leading-none ${scheme.text}`}>
          {value}%
        </span>
      </div>

      {/* Info popup */}
      {showInfo && (
        <div className="bg-black/50 rounded-xl px-4 py-3 space-y-1.5 border border-white/5">
          <p className="text-zinc-200 text-xs font-semibold">What is glycogen?</p>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Glycogen is your body&apos;s stored energy for exercise — like a battery. When it&apos;s
            full, you&apos;re ready to perform. When it&apos;s low, you need carbs to refuel. This
            estimate is based on what you&apos;ve eaten and how hard you&apos;ve trained.
          </p>
        </div>
      )}

      {/* Battery icon */}
      <BatterySVG value={value} color={scheme.hex} />

      {/* Contextual message + calibrate link */}
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${scheme.text}`}>{message}</p>
        <button
          type="button"
          onClick={() => { setShowCalibrate((x) => !x); setShowInfo(false); }}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
        >
          Calibrate →
        </button>
      </div>

      {/* Calibrate popup */}
      {showCalibrate && (
        <div className="bg-black/60 rounded-xl px-4 py-4 space-y-3 border border-white/5">
          <div className="flex items-start justify-between">
            <p className="text-zinc-200 text-xs font-semibold">Calibrate glycogen</p>
            <button
              onClick={() => setShowCalibrate(false)}
              className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors ml-3"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Calibrate your glycogen estimate to match how you feel right now. Use this after a long
            hard ride (empty) or after a rest day with good carb intake (topped up).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => calibrate(10)}
              disabled={calibrating}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 leading-tight"
            >
              I&apos;m empty
              <span className="block text-zinc-600 font-normal mt-0.5">~10%</span>
            </button>
            <button
              type="button"
              onClick={() => calibrate(90)}
              disabled={calibrating}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 leading-tight"
            >
              I&apos;m topped up
              <span className="block text-zinc-600 font-normal mt-0.5">~90%</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── session hero ─────────────────────────────────────────────────────────────

const INTENSITY_LABEL: Record<string, string> = {
  easy:     "Easy",
  moderate: "Moderate",
  hard:     "Hard",
  race:     "Race pace",
};

const EVENT_TYPE_COLOUR: Record<string, string> = {
  ride: "border-lime-400/40 bg-lime-400/5",
  race: "border-orange-400/40 bg-orange-400/5",
  rest: "border-zinc-700 bg-zinc-900",
};

function SessionHero({
  event,
  fuelling,
  onEdit,
}: {
  event:    TodayEvent;
  fuelling: NonNullable<TodayPlan["onBikeFuelling"]> | null;
  onEdit:   () => void;
}) {
  const colour = EVENT_TYPE_COLOUR[event.eventType] ?? "border-zinc-700 bg-zinc-900";

  return (
    <div className={`rounded-2xl border px-4 py-4 space-y-4 ${colour}`}>
      {/* Session summary */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-white font-semibold text-base">{event.title}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-zinc-500 text-xs pt-0.5">
              {fmtTime(event.scheduledAt)}
            </span>
            <button
              type="button"
              onClick={onEdit}
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
            >
              Edit →
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-zinc-500">
          {event.durationMinutes && (
            <span>{fmtDuration(event.durationMinutes)}</span>
          )}
          {event.intensity && (
            <span>{INTENSITY_LABEL[event.intensity] ?? event.intensity}</span>
          )}
        </div>
        {event.notes && (
          <p className="text-zinc-600 text-xs mt-1">{event.notes}</p>
        )}
      </div>

      {fuelling ? (
        <div className="space-y-2.5">
          {/* Pre-ride */}
          <div className="bg-black/30 rounded-xl px-3 py-2.5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">Pre-ride</p>
              <span className="text-zinc-600 text-xs">{fuelling.pre.timing}</span>
            </div>
            <p className="text-zinc-400 text-sm">{fuelling.pre.description}</p>
            {fuelling.pre.items.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {fuelling.pre.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-xs text-zinc-500">
                    <span>{it.item}</span><span>{it.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* On-bike */}
          <div className="bg-lime-400/10 border border-lime-400/20 rounded-xl px-3 py-2.5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-lime-400 text-xs font-semibold uppercase tracking-wider">On bike</p>
              <span className="text-lime-600 text-xs tabular-nums">
                {fuelling.on_bike.carbs_per_hour}g carbs/hr
              </span>
            </div>
            {fuelling.on_bike.items.length > 0 ? (
              <ul className="space-y-0.5">
                {fuelling.on_bike.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-xs text-zinc-300">
                    <span>{it.item}</span><span className="text-zinc-500">{it.amount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-xs">
                {fuelling.on_bike.carbs_per_hour === 0
                  ? "Water and electrolytes only"
                  : `${fuelling.on_bike.carbs_per_hour}g carbs per hour`}
              </p>
            )}
          </div>

          {/* Post-ride */}
          <div className="bg-black/30 rounded-xl px-3 py-2.5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">Post-ride</p>
              <span className="text-zinc-600 text-xs">{fuelling.post.timing}</span>
            </div>
            <p className="text-zinc-400 text-sm">{fuelling.post.description}</p>
            {fuelling.post.items.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {fuelling.post.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-xs text-zinc-500">
                    <span>{it.item}</span><span>{it.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="text-zinc-600 text-sm">
          No fuelling plan generated for this session.{" "}
          <Link href="/plan" className="text-lime-600 underline">Generate one →</Link>
        </p>
      )}
    </div>
  );
}

// ─── meal card ────────────────────────────────────────────────────────────────

// Fixed palette — index-based, guaranteed distinct colours for each meal slot.
// Static strings so Tailwind never purges them.
const MEAL_PALETTE = [
  { dot: "bg-amber-400",  bar: "border-l-amber-400",  label: "text-amber-400",  divider: "border-amber-400/20" },
  { dot: "bg-sky-400",    bar: "border-l-sky-400",    label: "text-sky-400",    divider: "border-sky-400/20"   },
  { dot: "bg-violet-400", bar: "border-l-violet-400", label: "text-violet-400", divider: "border-violet-400/20" },
  { dot: "bg-lime-400",   bar: "border-l-lime-400",   label: "text-lime-400",   divider: "border-lime-400/20"  },
  { dot: "bg-orange-400", bar: "border-l-orange-400", label: "text-orange-400", divider: "border-orange-400/20" },
] as const;

function MealCard({
  meal,
  index,
  defaultOpen,
}: {
  meal:        TodayPlan["meals"][number];
  index:       number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accent = MEAL_PALETTE[index % MEAL_PALETTE.length];

  return (
    <div className={`bg-zinc-900 rounded-xl border-zinc-800 border border-l-4 overflow-hidden ${accent.bar}`}>
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-white text-sm font-medium">{meal.name}</p>
          <p className={`text-xs mt-0.5 ${accent.label}`}>{meal.timing}</p>
        </div>
        <span className="text-zinc-700 text-sm shrink-0 ml-2">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={`px-4 pb-3 border-t pt-2.5 ${accent.divider}`}>
          <ul className="space-y-1.5">
            {meal.ingredients.map((ing, i) => (
              <li key={i} className="flex items-baseline justify-between">
                <span className="text-zinc-300 text-sm">{ing.item}</span>
                <span className="text-zinc-600 text-xs tabular-nums ml-3">{ing.grams}g</span>
              </li>
            ))}
          </ul>
          {meal.cooking_note && (
            <p className="mt-2.5 text-xs text-zinc-500 italic leading-relaxed border-t border-zinc-800/60 pt-2">
              {meal.cooking_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── no-plan state ────────────────────────────────────────────────────────────

function NoPlan({
  events,
  onEdit,
}: {
  events: TodayEvent[];
  onEdit: (event: TodayEvent) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Training sessions without a plan */}
      {events
        .filter((e) => e.eventType !== "rest")
        .map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onEdit(e)}
            className={`w-full text-left rounded-2xl border px-4 py-4 hover:brightness-110 transition-all ${EVENT_TYPE_COLOUR[e.eventType] ?? "border-zinc-700 bg-zinc-900"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-white font-semibold">{e.title}</p>
              <span className="text-zinc-500 text-xs shrink-0 mt-0.5">Edit →</span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-zinc-500">
              <span>{fmtTime(e.scheduledAt)}</span>
              {e.durationMinutes && <span>{fmtDuration(e.durationMinutes)}</span>}
              {e.intensity && <span>{INTENSITY_LABEL[e.intensity] ?? e.intensity}</span>}
            </div>
          </button>
        ))}

      <div className="py-10 text-center space-y-4">
        <div className="space-y-1.5">
          <p className="text-zinc-400 font-medium">No fuelling plan for today</p>
          <p className="text-zinc-600 text-sm max-w-xs mx-auto leading-relaxed">
            Generate your plan to see exactly what to eat, when, and how much.
          </p>
        </div>
        <Link
          href="/plan"
          className="inline-block mt-2 px-6 py-2.5 bg-lime-400 text-black text-sm font-semibold rounded-full hover:bg-lime-300 transition-colors"
        >
          Go to plan →
        </Link>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

// ─── compliance badge ────────────────────────────────────────────────────────

const COMPLIANCE_BADGE: Record<string, { label: string; colour: string }> = {
  yes:    { label: "Followed the plan",   colour: "bg-lime-400/10 text-lime-400 border-lime-400/20" },
  mostly: { label: "Mostly followed it",  colour: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  no:     { label: "Didn't follow it",    colour: "bg-zinc-800 text-zinc-400 border-zinc-700" },
};

function CheckInCard({
  existing,
  onOpen,
}: {
  existing: ExistingCheckIn | null;
  onOpen:   () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border hover:brightness-110 transition-colors text-left ${
        existing
          ? "bg-lime-400/5 border-lime-400/30"
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div>
        <p className="text-white text-sm font-medium">End of day check-in</p>
        {existing ? (
          <p className="text-zinc-500 text-xs mt-0.5">
            {COMPLIANCE_BADGE[existing.compliance].label}
          </p>
        ) : (
          <p className="text-zinc-600 text-xs mt-0.5">Did you follow the plan today?</p>
        )}
      </div>
      {existing
        ? <span className="text-lime-400 text-xl font-bold shrink-0 ml-3">✓</span>
        : <span className="text-zinc-600 text-xs shrink-0 ml-3">Log →</span>
      }
    </button>
  );
}

export default function DailyDashboard({
  todayStr,
  todayPlan,
  todayEvents,
  profile,
  existingCheckIn,
  firstName,
  todayWeighIn,
  trackStoolHealth = false,
  unitSystem = "metric",
  timezone = "Europe/London",
}: {
  todayStr:           string;
  todayPlan:          TodayPlan | null;
  todayEvents:        TodayEvent[];
  profile:            ProfileSnapshot | null;
  existingCheckIn:    ExistingCheckIn | null;
  firstName:          string | null;
  todayWeighIn:       { weightKg: number; bodyFatPct: number | null } | null;
  trackStoolHealth?:  boolean;
  unitSystem?:        UnitSystem;
  timezone?:          string;
}) {
  const [weighInOpen,    setWeighInOpen]    = useState(false);
  const [checkInOpen,    setCheckInOpen]    = useState(false);
  const [savedCheckIn,   setSavedCheckIn]   = useState<ExistingCheckIn | null>(existingCheckIn);
  const [displayWeight,  setDisplayWeight]  = useState<number | null>(todayWeighIn?.weightKg ?? null);
  const [displayBf,      setDisplayBf]      = useState<number | null>(todayWeighIn?.bodyFatPct ?? null);
  const [glycogenValue,  setGlycogenValue]  = useState<number>(todayPlan?.glycogenBattery ?? 50);
  const [events,         setEvents]         = useState<TodayEvent[]>(todayEvents);
  const [editingEvent,   setEditingEvent]   = useState<EditableEvent | null>(null);

  const trainingEvent = events.find(
    (e) => e.eventType === "ride" || e.eventType === "race"
  ) ?? null;

  const isTrainingDay = !!trainingEvent;

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-5">
          {/* Header */}
          <div className="space-y-3">
            <div>
              <p className="text-zinc-500 text-sm">
                {getLocalTime(timezone)} · {greeting(timezone)}{firstName ? `, ${firstName}` : ""}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
                {fmtLongDate(todayStr)}
              </h1>
            </div>

            {/* Weight summary */}
            {(displayWeight || profile?.targetWeightKg) && (
              <div className="flex items-center gap-3">
                {displayWeight && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-white text-2xl font-bold tabular-nums">
                      {kgToDisplay(displayWeight, unitSystem).toFixed(1)}
                    </span>
                    <span className="text-zinc-500 text-sm">{weightLabel(unitSystem)}</span>
                    {displayBf && (
                      <span className="text-zinc-600 text-xs ml-1">· {displayBf.toFixed(1)}% bf</span>
                    )}
                  </div>
                )}
                {displayWeight && profile?.targetWeightKg && (
                  <>
                    <div className="w-px h-5 bg-zinc-800" />
                    {(() => {
                      const diffKg = parseFloat((displayWeight - profile.targetWeightKg).toFixed(2));
                      const diffDisplay = kgToDisplay(Math.abs(diffKg), unitSystem).toFixed(1);
                      const wl = weightLabel(unitSystem);
                      const targetDisplay = kgToDisplay(profile.targetWeightKg, unitSystem).toFixed(1);
                      if (diffKg > 0) return (
                        <p className="text-zinc-500 text-sm">
                          <span className="text-lime-400 font-semibold">{diffDisplay} {wl}</span> to go
                          <span className="text-zinc-500 text-sm"> · target {targetDisplay} {wl}</span>
                        </p>
                      );
                      if (diffKg < 0) return (
                        <p className="text-zinc-500 text-sm">
                          <span className="text-lime-400 font-semibold">{diffDisplay} {wl}</span> above target
                          <span className="text-zinc-500 text-sm"> · target {targetDisplay} {wl}</span>
                        </p>
                      );
                      return <p className="text-lime-400 text-sm font-semibold">Target reached</p>;
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Weigh-in card */}
          <button
            onClick={() => setWeighInOpen(true)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border hover:brightness-110 transition-colors text-left ${
              displayWeight
                ? "bg-lime-400/5 border-lime-400/30"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div>
              <p className="text-white text-sm font-medium">Morning weigh-in</p>
              {displayWeight ? (
                <p className="text-zinc-500 text-xs mt-0.5">
                  {kgToDisplay(displayWeight, unitSystem).toFixed(1)}{weightLabel(unitSystem)}
                  {displayBf && <span> · {displayBf.toFixed(1)}% bf</span>}
                </p>
              ) : (
                <p className="text-zinc-600 text-xs mt-0.5">Log your morning weight</p>
              )}
            </div>
            {displayWeight
              ? <span className="text-lime-400 text-xl font-bold shrink-0 ml-3">✓</span>
              : <span className="text-zinc-600 text-xs shrink-0 ml-3">Log →</span>
            }
          </button>

          {/* Check-in card */}
          <CheckInCard existing={savedCheckIn} onOpen={() => setCheckInOpen(true)} />

          {todayPlan ? (
            <>
              {/* Glycogen battery */}
              <GlyBattery
                value={glycogenValue}
                todayStr={todayStr}
                onCalibrate={setGlycogenValue}
              />

              {/* AI reasoning */}
              {todayPlan.aiReasoning && (
                <p className="text-zinc-500 text-sm italic leading-relaxed px-1">
                  &ldquo;{todayPlan.aiReasoning}&rdquo;
                </p>
              )}

              {/* Macro summary */}
              {todayPlan.totalCalories != null && (
                <div className="flex items-center gap-4 px-1">
                  <div className="text-center">
                    <p className="text-white text-xl font-bold tabular-nums">
                      {todayPlan.totalCalories}
                    </p>
                    <p className="text-zinc-600 text-xs">kcal</p>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {[
                      { label: "Carbs",   val: todayPlan.totalCarbsG,   colour: "text-lime-400" },
                      { label: "Protein", val: todayPlan.totalProteinG, colour: "text-blue-400" },
                      { label: "Fat",     val: todayPlan.totalFatG,     colour: "text-amber-400" },
                    ].map(({ label, val, colour }) =>
                      val != null ? (
                        <div key={label} className="bg-zinc-900 rounded-xl px-2 py-2 text-center">
                          <p className={`text-sm font-bold tabular-nums ${colour}`}>{val}g</p>
                          <p className="text-zinc-600 text-xs">{label}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Session fuelling hero — training days only */}
              {isTrainingDay && trainingEvent && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Today&apos;s session
                  </p>
                  <SessionHero
                    event={trainingEvent}
                    fuelling={todayPlan.onBikeFuelling}
                    onEdit={() => setEditingEvent(trainingEvent)}
                  />
                </div>
              )}

              {/* Rest-day notice */}
              {!isTrainingDay && (
                <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-zinc-600 text-lg">🛋</span>
                  <p className="text-zinc-400 text-sm">Rest day — recovery nutrition active</p>
                </div>
              )}

              {/* Meals */}
              {todayPlan.meals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Meals
                  </p>
                  {todayPlan.meals.map((meal, i) => (
                    <MealCard key={i} meal={meal} index={i} defaultOpen={i === 0} />
                  ))}
                </div>
              )}

              {/* Supplements */}
              {todayPlan.supplements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Supplements
                  </p>
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                    {todayPlan.supplements.map((s, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-white text-sm">{s.name}</p>
                          <p className="text-zinc-600 text-xs">{s.dose}</p>
                        </div>
                        <span className="text-zinc-500 text-xs">{s.timing}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <NoPlan events={events} onEdit={setEditingEvent} />
          )}
        </div>
      </main>

      {weighInOpen && (
        <WeighInSheet
          latestWeightKg={displayWeight}
          latestBodyFatPct={displayBf}
          unitSystem={unitSystem}
          onClose={() => setWeighInOpen(false)}
          onSaved={(weightKg, bodyFatPct) => {
            setDisplayWeight(weightKg);
            if (bodyFatPct !== null) setDisplayBf(bodyFatPct);
            setWeighInOpen(false);
          }}
        />
      )}

      {checkInOpen && (
        <CheckInSheet
          todayStr={todayStr}
          isTrainingDay={isTrainingDay}
          trackStoolHealth={trackStoolHealth}
          existing={savedCheckIn}
          onClose={() => setCheckInOpen(false)}
          onSaved={(result) => {
            setSavedCheckIn(result);
            setCheckInOpen(false);
          }}
        />
      )}

      {editingEvent && (
        <EditEventSheet
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdated={(updated) => {
            setEditingEvent(null);
            setEvents((prev) =>
              prev.map((e) =>
                e.id === updated.id
                  ? {
                      ...e,
                      title:           updated.title,
                      eventType:       updated.eventType,
                      scheduledAt:     updated.scheduledAt,
                      durationMinutes: updated.durationMinutes,
                      intensity:       updated.intensity,
                      notes:           updated.notes,
                    }
                  : e
              )
            );
          }}
          onDeleted={(id) => {
            setEditingEvent(null);
            setEvents((prev) => prev.filter((e) => e.id !== id));
          }}
        />
      )}

      <BottomNav active="today" />
    </>
  );
}
