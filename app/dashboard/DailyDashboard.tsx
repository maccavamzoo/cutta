"use client";

import { useState } from "react";
import Link from "next/link";
import type { DayPlanOutput } from "@/lib/ai/buildPlanPrompt";
import BottomNav from "@/components/BottomNav";
import CheckInSheet, { type ExistingCheckIn } from "./CheckInSheet";

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

function greeting(): string {
  const h = new Date().getHours();
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

function GlyBattery({ value }: { value: number }) {
  const [showInfo, setShowInfo] = useState(false);

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

  return (
    <div className={`rounded-2xl border px-5 py-4 space-y-3 ${scheme.card}`}>
      {/* Title + % */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
            Approx. Glycogen
          </span>
          <button
            onClick={() => setShowInfo((x) => !x)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors text-sm leading-none"
            aria-label="What is glycogen?"
          >
            ⓘ
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

      {/* Contextual message */}
      <p className={`text-sm font-semibold ${scheme.text}`}>{message}</p>
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
}: {
  event:    TodayEvent;
  fuelling: NonNullable<TodayPlan["onBikeFuelling"]> | null;
}) {
  const colour = EVENT_TYPE_COLOUR[event.eventType] ?? "border-zinc-700 bg-zinc-900";

  return (
    <div className={`rounded-2xl border px-4 py-4 space-y-4 ${colour}`}>
      {/* Session summary */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-white font-semibold text-base">{event.title}</p>
          <span className="text-zinc-500 text-xs shrink-0 pt-0.5">
            {fmtTime(event.scheduledAt)}
          </span>
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

function NoPlan({ events }: { events: TodayEvent[] }) {
  return (
    <div className="space-y-5">
      {/* Training sessions without a plan */}
      {events
        .filter((e) => e.eventType !== "rest")
        .map((e) => (
          <div
            key={e.id}
            className={`rounded-2xl border px-4 py-4 ${EVENT_TYPE_COLOUR[e.eventType] ?? "border-zinc-700 bg-zinc-900"}`}
          >
            <p className="text-white font-semibold">{e.title}</p>
            <div className="flex gap-3 mt-1 text-xs text-zinc-500">
              <span>{fmtTime(e.scheduledAt)}</span>
              {e.durationMinutes && <span>{fmtDuration(e.durationMinutes)}</span>}
              {e.intensity && <span>{INTENSITY_LABEL[e.intensity] ?? e.intensity}</span>}
            </div>
          </div>
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
  if (existing) {
    const badge = COMPLIANCE_BADGE[existing.compliance];
    return (
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors text-left"
      >
        <div className="space-y-0.5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Daily check-in</p>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.colour}`}>
            {badge.label}
          </span>
        </div>
        <span className="text-zinc-600 text-xs shrink-0 ml-3">Edit →</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center justify-between px-4 py-3.5 bg-zinc-900 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 transition-colors text-left"
    >
      <div>
        <p className="text-white text-sm font-medium">Daily check-in</p>
        <p className="text-zinc-600 text-xs mt-0.5">Did you follow the plan today?</p>
      </div>
      <span className="text-lime-400 text-sm font-semibold shrink-0 ml-3">Check in →</span>
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
  latestWeightKg,
  latestBodyFatPct,
}: {
  todayStr:          string;
  todayPlan:         TodayPlan | null;
  todayEvents:       TodayEvent[];
  profile:           ProfileSnapshot | null;
  existingCheckIn:   ExistingCheckIn | null;
  firstName:         string | null;
  latestWeightKg:    number | null;
  latestBodyFatPct:  number | null;
}) {
  const [checkInOpen,    setCheckInOpen]    = useState(false);
  const [savedCheckIn,   setSavedCheckIn]   = useState<ExistingCheckIn | null>(existingCheckIn);
  const [displayWeight,  setDisplayWeight]  = useState<number | null>(latestWeightKg);
  const [displayBf,      setDisplayBf]      = useState<number | null>(latestBodyFatPct);

  const trainingEvent = todayEvents.find(
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
                {greeting()}{firstName ? `, ${firstName}` : ""}
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
                      {displayWeight.toFixed(1)}
                    </span>
                    <span className="text-zinc-500 text-sm">kg</span>
                    {displayBf && (
                      <span className="text-zinc-600 text-xs ml-1">· {displayBf.toFixed(1)}% bf</span>
                    )}
                  </div>
                )}
                {displayWeight && profile?.targetWeightKg && (
                  <>
                    <div className="w-px h-5 bg-zinc-800" />
                    {(() => {
                      const diff = parseFloat((displayWeight - profile.targetWeightKg).toFixed(1));
                      if (diff > 0) return (
                        <p className="text-zinc-500 text-sm">
                          <span className="text-lime-400 font-semibold">{diff} kg</span> to go
                        </p>
                      );
                      if (diff < 0) return (
                        <p className="text-zinc-500 text-sm">
                          <span className="text-lime-400 font-semibold">{Math.abs(diff)} kg</span> above target
                        </p>
                      );
                      return <p className="text-lime-400 text-sm font-semibold">Target reached</p>;
                    })()}
                  </>
                )}
                {!displayWeight && profile?.targetWeightKg && (
                  <button
                    onClick={() => setCheckInOpen(true)}
                    className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors"
                  >
                    Log today&apos;s weight →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Check-in card — always visible */}
          <CheckInCard existing={savedCheckIn} onOpen={() => setCheckInOpen(true)} />

          {todayPlan ? (
            <>
              {/* Glycogen battery */}
              <GlyBattery value={todayPlan.glycogenBattery ?? 50} />

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
            <NoPlan events={todayEvents} />
          )}

          {/* Quick links row */}
          <div className="flex gap-2 pt-1">
            <Link
              href="/shopping"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-medium hover:border-zinc-700 transition-colors"
            >
              <span>☑</span> Shopping list
            </Link>
            <Link
              href="/training/upload"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-medium hover:border-zinc-700 transition-colors"
            >
              <span>↑</span> Log training
            </Link>
          </div>
        </div>
      </main>

      {checkInOpen && (
        <CheckInSheet
          todayStr={todayStr}
          isTrainingDay={isTrainingDay}
          existing={savedCheckIn}
          onClose={() => setCheckInOpen(false)}
          onSaved={(result) => {
            setSavedCheckIn(result);
            if (result.weightKg !== null) setDisplayWeight(result.weightKg);
            if (result.bodyFatPct !== null) setDisplayBf(result.bodyFatPct);
            setCheckInOpen(false);
          }}
        />
      )}

      <BottomNav active="today" />
    </>
  );
}
