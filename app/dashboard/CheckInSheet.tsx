"use client";

import { useState } from "react";
import { kgToDisplay, displayToKg, weightLabel, weightInputRange, type UnitSystem } from "@/lib/units";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ExistingCheckIn {
  compliance:  "yes" | "mostly" | "no";
  rideEnergy:  number | null;
  gutComfort:  number | null;
  hunger:      number | null;
  weightKg:    number | null;
  bodyFatPct:  number | null;
}

interface Props {
  todayStr:        string;
  isTrainingDay:   boolean;
  existing:        ExistingCheckIn | null;       // compliance / feedback pre-fill
  latestWeight?:   { weightKg: number | null; bodyFatPct: number | null } | null;
  unitSystem?:     UnitSystem;
  onClose:         () => void;
  onWeightSaved?:  (weightKg: number, bodyFatPct: number | null) => void;
  onSaved:         (result: ExistingCheckIn) => void;
}

// ─── constants ────────────────────────────────────────────────────────────────

const COMPLIANCE_OPTIONS = [
  { value: "yes",    label: "Yes",    sub: "Followed the plan",       colour: "bg-lime-400  text-black",    ring: "ring-lime-400" },
  { value: "mostly", label: "Mostly", sub: "Close but deviated",      colour: "bg-amber-400 text-black",    ring: "ring-amber-400" },
  { value: "no",     label: "No",     sub: "Didn't follow it today",  colour: "bg-zinc-700  text-zinc-200", ring: "ring-zinc-500" },
] as const;

type ComplianceValue = "yes" | "mostly" | "no";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Low",
  3: "OK",
  4: "Good",
  5: "Great",
};

const SIGNAL_LABEL: Record<string, string> = {
  rideEnergy: "Ride energy",
  gutComfort: "Gut comfort",
  hunger:     "Hunger",
};

const SIGNAL_SUB: Record<string, string> = {
  rideEnergy: "How fuelled did you feel on the ride?",
  gutComfort: "Any bloating, discomfort or gut issues?",
  hunger:     "Coping with the plan, or constantly starving?",
};

// ─── rating row ───────────────────────────────────────────────────────────────

function RatingRow({
  signal,
  value,
  onChange,
}: {
  signal:   string;
  value:    number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-white text-sm font-medium">{SIGNAL_LABEL[signal]}</p>
        <p className="text-zinc-600 text-xs mt-0.5">{SIGNAL_SUB[signal]}</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              value === n
                ? "bg-lime-400 text-black scale-105"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value !== null && (
        <p className={`text-xs mt-1.5 text-right font-medium ${
          value >= 4 ? "text-lime-400" : value >= 3 ? "text-amber-400" : "text-red-400"
        }`}>
          {RATING_LABELS[value]}
        </p>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CheckInSheet({
  todayStr,
  isTrainingDay,
  existing,
  latestWeight,
  unitSystem = "metric",
  onClose,
  onWeightSaved,
  onSaved,
}: Props) {
  const wLabel = weightLabel(unitSystem);
  const wRange = weightInputRange(unitSystem);

  // ── morning weigh-in state ────────────────────────────────────────────────
  const [weightStr,    setWeightStr]    = useState(
    latestWeight?.weightKg != null
      ? String(kgToDisplay(latestWeight.weightKg, unitSystem))
      : ""
  );
  const [bfStr,        setBfStr]        = useState(
    latestWeight?.bodyFatPct != null ? String(latestWeight.bodyFatPct) : ""
  );
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightSaved,  setWeightSaved]  = useState(false);
  const [weightError,  setWeightError]  = useState<string | null>(null);

  // ── end-of-day state ──────────────────────────────────────────────────────
  const [compliance,  setCompliance]  = useState<ComplianceValue | null>(existing?.compliance ?? null);
  const [rideEnergy,  setRideEnergy]  = useState<number | null>(existing?.rideEnergy ?? null);
  const [gutComfort,  setGutComfort]  = useState<number | null>(existing?.gutComfort ?? null);
  const [hunger,      setHunger]      = useState<number | null>(existing?.hunger     ?? null);
  const [notes,       setNotes]       = useState("");
  const [endSaving,   setEndSaving]   = useState(false);
  const [endError,    setEndError]    = useState<string | null>(null);

  // ── morning weigh-in save ─────────────────────────────────────────────────

  async function handleSaveWeight() {
    const displayVal = weightStr.trim() ? parseFloat(weightStr.trim()) : null;
    if (displayVal === null) return;

    if (isNaN(displayVal) || displayVal < wRange.min || displayVal > wRange.max) {
      setWeightError(`Enter a valid weight (${wRange.min}–${wRange.max} ${wLabel}).`);
      return;
    }
    const bodyFatPct = bfStr.trim() ? parseFloat(bfStr.trim()) : null;
    if (bodyFatPct !== null && (isNaN(bodyFatPct) || bodyFatPct < 1 || bodyFatPct > 70)) {
      setWeightError("Enter a valid body fat % (1–70).");
      return;
    }

    const weightKg = displayToKg(displayVal, unitSystem);
    setWeightSaving(true);
    setWeightError(null);

    try {
      const res = await fetch("/api/weight-log", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ weightKg, bodyFatPct }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save weight.");
      }
      setWeightSaved(true);
      onWeightSaved?.(weightKg, bodyFatPct);
    } catch (err) {
      setWeightError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWeightSaving(false);
    }
  }

  // ── end-of-day save ───────────────────────────────────────────────────────

  async function handleSaveEndOfDay() {
    if (!compliance) return;
    setEndSaving(true);
    setEndError(null);

    try {
      // 1 — Compliance
      const compRes = await fetch("/api/compliance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ logDate: todayStr, compliance, notes: notes.trim() || undefined }),
      });
      if (!compRes.ok) {
        const d = await compRes.json();
        throw new Error(d.error ?? "Failed to save compliance.");
      }

      // 2 — Feedback signals (only those rated)
      const feedbacks = [
        isTrainingDay && rideEnergy !== null
          ? { feedbackType: "ride_energy" as const, rating: rideEnergy }
          : null,
        gutComfort !== null ? { feedbackType: "gut_comfort" as const, rating: gutComfort } : null,
        hunger     !== null ? { feedbackType: "hunger"      as const, rating: hunger     } : null,
      ].filter(Boolean);

      if (feedbacks.length > 0) {
        const fbRes = await fetch("/api/feedback", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ planDate: todayStr, feedbacks }),
        });
        if (!fbRes.ok) {
          const d = await fbRes.json();
          throw new Error(d.error ?? "Failed to save feedback.");
        }
      }

      onSaved({
        compliance,
        rideEnergy: isTrainingDay ? rideEnergy : null,
        gutComfort,
        hunger,
        weightKg:   latestWeight?.weightKg   ?? null,
        bodyFatPct: latestWeight?.bodyFatPct ?? null,
      });
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setEndSaving(false);
    }
  }

  const canSaveWeight   = weightStr.trim().length > 0;
  const canSaveEndOfDay = compliance !== null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl max-w-lg mx-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        <div className="overflow-y-auto max-h-[85dvh] px-4 pb-10">
          {/* Header */}
          <div className="flex items-center justify-between py-3 mb-1">
            <h2 className="text-white font-semibold text-base">Daily check-in</h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Close
            </button>
          </div>

          <div className="space-y-6">

            {/* ── Morning weigh-in ─────────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                Morning weigh-in
              </p>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-white text-sm font-medium mb-1.5">Weight</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={wRange.step}
                      min={wRange.min}
                      max={wRange.max}
                      placeholder={unitSystem === "imperial" ? "e.g. 161.8" : "e.g. 73.4"}
                      value={weightStr}
                      onChange={(e) => { setWeightStr(e.target.value); setWeightSaved(false); }}
                      className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">{wLabel}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-white text-sm font-medium mb-1.5">Body fat <span className="text-zinc-600 font-normal">(optional)</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="1"
                      max="70"
                      placeholder="e.g. 14.2"
                      value={bfStr}
                      onChange={(e) => { setBfStr(e.target.value); setWeightSaved(false); }}
                      className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">%</span>
                  </div>
                </div>
              </div>

              {weightError && <p className="text-red-400 text-sm">{weightError}</p>}

              {weightSaved ? (
                <p className="text-lime-400 text-sm font-medium">Weigh-in saved ✓</p>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveWeight}
                  disabled={!canSaveWeight || weightSaving}
                  className="w-full py-3 bg-zinc-800 text-white font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  {weightSaving ? "Saving…" : "Save weigh-in"}
                </button>
              )}
            </section>

            {/* ── Divider ──────────────────────────────────────────────────── */}
            <div className="border-t border-zinc-800" />

            {/* ── End-of-day check-in ──────────────────────────────────────── */}
            <section className="space-y-6">
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                End of day
              </p>

              {/* Compliance */}
              <div>
                <p className="text-white text-sm font-medium mb-3">Did you follow the plan today?</p>
                <div className="grid grid-cols-3 gap-2">
                  {COMPLIANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCompliance(opt.value)}
                      className={`flex flex-col items-center gap-1 py-4 rounded-2xl font-semibold text-sm transition-all ${
                        compliance === opt.value
                          ? `${opt.colour} ring-2 ${opt.ring} scale-[1.02]`
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      <span className="text-base font-bold">{opt.label}</span>
                      <span className={`text-xs font-normal leading-tight text-center ${
                        compliance === opt.value ? "opacity-80" : "text-zinc-600"
                      }`}>
                        {opt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback signals */}
              <div className="space-y-5">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold -mb-1">
                  How did it feel?
                </p>
                {isTrainingDay && (
                  <RatingRow signal="rideEnergy" value={rideEnergy} onChange={setRideEnergy} />
                )}
                <RatingRow signal="gutComfort" value={gutComfort} onChange={setGutComfort} />
                <RatingRow signal="hunger"     value={hunger}     onChange={setHunger} />
              </div>

              {/* Optional notes */}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to add? (optional)"
                rows={2}
                className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 resize-none"
              />

              {endError && <p className="text-red-400 text-sm">{endError}</p>}

              <button
                type="button"
                onClick={handleSaveEndOfDay}
                disabled={!canSaveEndOfDay || endSaving}
                className="w-full py-3.5 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
              >
                {endSaving ? "Saving…" : "Save end-of-day"}
              </button>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
