"use client";

import { useState } from "react";
import type { DayPlanOutput } from "@/lib/ai/buildPlanPrompt";

// ─── types ────────────────────────────────────────────────────────────────────

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

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isToday(dateStr: string): boolean {
  return new Date().toISOString().split("T")[0] === dateStr;
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

const DAY_TYPE_BADGE: Record<string, string> = {
  training: "bg-lime-400/10 text-lime-400 border border-lime-400/30",
  race:     "bg-orange-400/10 text-orange-400 border border-orange-400/30",
  rest:     "bg-zinc-800 text-zinc-500 border border-zinc-700",
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
      <span className={`text-xs font-semibold tabular-nums w-14 text-right ${batteryTextColour(value)}`}>
        {batteryLabel(value)} {value}%
      </span>
    </div>
  );
}

function MacroRow({ cal, carbs, protein, fat }: {
  cal: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
}) {
  return (
    <div className="flex gap-3 text-xs tabular-nums">
      {cal != null && (
        <span className="text-white font-semibold">{cal} kcal</span>
      )}
      {carbs != null && (
        <span className="text-zinc-500">C: <span className="text-zinc-300">{carbs}g</span></span>
      )}
      {protein != null && (
        <span className="text-zinc-500">P: <span className="text-zinc-300">{protein}g</span></span>
      )}
      {fat != null && (
        <span className="text-zinc-500">F: <span className="text-zinc-300">{fat}g</span></span>
      )}
    </div>
  );
}

function MealCard({ meal }: { meal: DayPlanOutput["meals"][number] }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="text-white text-sm font-medium">{meal.name}</p>
        <span className="text-zinc-600 text-xs shrink-0">{meal.timing}</span>
      </div>
      <ul className="space-y-0.5">
        {meal.ingredients.map((ing, i) => (
          <li key={i} className="flex justify-between text-xs text-zinc-400">
            <span>{ing.item}</span>
            <span className="text-zinc-600 tabular-nums">{ing.grams}g</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OnBikeCard({ fuelling }: { fuelling: NonNullable<DayPlanOutput["on_bike_fuelling"]> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">On-bike fuelling</p>

      {/* Pre-ride */}
      <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-white text-xs font-semibold">Pre-ride</p>
          <span className="text-zinc-600 text-xs">{fuelling.pre.timing}</span>
        </div>
        <p className="text-zinc-400 text-xs mb-1.5">{fuelling.pre.description}</p>
        {fuelling.pre.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-500">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>

      {/* On-bike */}
      <div className="bg-lime-400/5 border border-lime-400/20 rounded-lg px-3 py-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-lime-400 text-xs font-semibold">On bike</p>
          <span className="text-lime-600 text-xs tabular-nums">{fuelling.on_bike.carbs_per_hour}g carbs/hr</span>
        </div>
        {fuelling.on_bike.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-400">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>

      {/* Post-ride */}
      <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-white text-xs font-semibold">Post-ride</p>
          <span className="text-zinc-600 text-xs">{fuelling.post.timing}</span>
        </div>
        <p className="text-zinc-400 text-xs mb-1.5">{fuelling.post.description}</p>
        {fuelling.post.items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs text-zinc-500">
            <span>{it.item}</span><span>{it.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCard({ plan }: { plan: StoredPlan }) {
  const [expanded, setExpanded] = useState(isToday(plan.planDate));
  const today = isToday(plan.planDate);
  const battery = plan.glycogenBattery ?? 50;
  const dayType = (plan.onBikeFuelling ? (
    (plan.meals.some((m) => m.name.toLowerCase().includes("race")) ? "race" : "training")
  ) : "rest") as "rest" | "training" | "race";

  return (
    <div
      className={`rounded-xl border transition-colors ${
        today
          ? "border-lime-400/30 bg-zinc-900"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      {/* Day header — always visible */}
      <button
        className="w-full px-4 py-3 text-left"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${today ? "text-lime-400" : "text-white"}`}>
              {fmtDay(plan.planDate)}
              {today && <span className="ml-1.5 text-xs font-normal text-lime-600">Today</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${DAY_TYPE_BADGE[dayType]}`}>
              {dayType}
            </span>
          </div>
          <span className="text-zinc-700 text-sm shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>

        <GlyBattery value={battery} />

        {plan.aiReasoning && (
          <p className="text-zinc-500 text-xs italic mt-2 leading-relaxed">
            {plan.aiReasoning}
          </p>
        )}

        <div className="mt-2">
          <MacroRow
            cal={plan.totalCalories}
            carbs={plan.totalCarbsG}
            protein={plan.totalProteinG}
            fat={plan.totalFatG}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-3">
          {/* Meals */}
          {plan.meals && plan.meals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Meals</p>
              {plan.meals.map((meal, i) => (
                <MealCard key={i} meal={meal} />
              ))}
            </div>
          )}

          {/* On-bike fuelling */}
          {plan.onBikeFuelling && (
            <OnBikeCard fuelling={plan.onBikeFuelling} />
          )}

          {/* Supplements */}
          {plan.supplements && plan.supplements.length > 0 && (
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

// ─── main component ───────────────────────────────────────────────────────────

export default function PlanView({ initialPlans }: { initialPlans: StoredPlan[] }) {
  const [plans] = useState<StoredPlan[]>(initialPlans);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setStatus("Sending your training data to the AI…");

    let res: Response;
    try {
      res = await fetch("/api/fuelling-plan/generate", { method: "POST" });
    } catch (networkErr) {
      setError(`Network error — could not reach the server. ${networkErr instanceof Error ? networkErr.message : ""}`);
      setGenerating(false);
      setStatus(null);
      return;
    }

    // Guard against non-JSON responses (e.g. HTML 500 page from Next.js)
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      setError(`Server error (${res.status}). Check server logs — ANTHROPIC_API_KEY may not be set in .env.local.`);
      setGenerating(false);
      setStatus(null);
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? `Generation failed (${res.status}).`);
      setGenerating(false);
      setStatus(null);
      return;
    }

    const msg = `Plan generated for ${data.generated} day${data.generated !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed to save)` : ""}.`;
    setStatus(msg);

    // Reload to get fresh server-rendered data
    setTimeout(() => window.location.reload(), 900);
  }

  const hasPlan = plans.length > 0;
  const lastGenerated = hasPlan
    ? new Date(plans[0].generatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {lastGenerated && (
            <p className="text-zinc-600 text-xs">Last generated {lastGenerated}</p>
          )}
          {status && (
            <p className="text-lime-400 text-xs mt-0.5">{status}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm mt-0.5">{error}</p>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 ${
            generating
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : "bg-lime-400 text-black hover:bg-lime-300 active:bg-lime-500"
          }`}
        >
          {generating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            hasPlan ? "Regenerate" : "Generate plan"
          )}
        </button>
      </div>

      {/* Plan days */}
      {hasPlan ? (
        <div className="space-y-3">
          {plans.map((p) => (
            <DayCard key={p.id} plan={p} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-4">
          <div className="space-y-1">
            <p className="text-zinc-400 text-base font-medium">No plan yet</p>
            <p className="text-zinc-600 text-sm max-w-64 mx-auto leading-relaxed">
              Generate your 14-day fuelling plan based on your training schedule and protocol.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-2 px-8 py-3 bg-lime-400 text-black font-semibold rounded-full text-sm hover:bg-lime-300 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : "Generate plan"}
          </button>
        </div>
      )}
    </div>
  );
}
