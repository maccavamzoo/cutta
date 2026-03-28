"use client";

import { useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ExistingCheckIn {
  compliance:   "yes" | "mostly" | "no";
  rideEnergy:   number | null;
  gutComfort:   number | null;
  hunger:       number | null;
  stoolHealth:  number | null;
}

interface Props {
  todayStr:         string;
  isTrainingDay:    boolean;
  trackStoolHealth: boolean;
  existing:         ExistingCheckIn | null;
  onClose:          () => void;
  onSaved:          (result: ExistingCheckIn) => void;
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
  rideEnergy:  "Ride energy",
  gutComfort:  "Gut comfort",
  hunger:      "Hunger",
  stoolHealth: "Stool health",
};

const SIGNAL_SUB: Record<string, string> = {
  rideEnergy:  "How fuelled did you feel on the ride?",
  gutComfort:  "Any bloating, discomfort or gut issues?",
  hunger:      "Coping with the plan, or constantly starving?",
  stoolHealth: "How were your stools today?",
};

const STOOL_LABELS: Record<number, string> = {
  1: "Very loose",
  2: "Loose",
  3: "Normal",
  4: "Hard",
  5: "Very hard",
};

// ─── rating row ───────────────────────────────────────────────────────────────

function RatingRow({
  signal,
  value,
  onChange,
  ratingLabels,
  colorFn,
}: {
  signal:        string;
  value:         number | null;
  onChange:      (v: number) => void;
  ratingLabels?: Record<number, string>;
  colorFn?:      (v: number) => string;
}) {
  const labels   = ratingLabels ?? RATING_LABELS;
  const getColor = colorFn ?? ((v: number) =>
    v >= 4 ? "text-lime-400" : v >= 3 ? "text-amber-400" : "text-red-400"
  );

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
        <p className={`text-xs mt-1.5 text-right font-medium ${getColor(value)}`}>
          {labels[value]}
        </p>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CheckInSheet({
  todayStr,
  isTrainingDay,
  trackStoolHealth,
  existing,
  onClose,
  onSaved,
}: Props) {
  const [compliance,  setCompliance]  = useState<ComplianceValue | null>(existing?.compliance   ?? null);
  const [rideEnergy,  setRideEnergy]  = useState<number | null>(existing?.rideEnergy  ?? null);
  const [gutComfort,  setGutComfort]  = useState<number | null>(existing?.gutComfort  ?? null);
  const [hunger,      setHunger]      = useState<number | null>(existing?.hunger      ?? null);
  const [stoolHealth, setStoolHealth] = useState<number | null>(existing?.stoolHealth ?? null);
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!compliance) return;
    setSaving(true);
    setError(null);

    try {
      const compRes = await fetch("/api/compliance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ logDate: todayStr, compliance, notes: notes.trim() || undefined }),
      });
      if (!compRes.ok) {
        const d = await compRes.json();
        throw new Error(d.error ?? "Failed to save compliance.");
      }

      const feedbacks = [
        isTrainingDay && rideEnergy !== null
          ? { feedbackType: "ride_energy"   as const, rating: rideEnergy  }
          : null,
        gutComfort  !== null ? { feedbackType: "gut_comfort"  as const, rating: gutComfort  } : null,
        hunger      !== null ? { feedbackType: "hunger"       as const, rating: hunger      } : null,
        stoolHealth !== null ? { feedbackType: "stool_health" as const, rating: stoolHealth } : null,
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
        rideEnergy:  isTrainingDay ? rideEnergy : null,
        gutComfort,
        hunger,
        stoolHealth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl max-w-lg mx-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        <div className="overflow-y-auto max-h-[85dvh] px-4 pb-10">
          <div className="flex items-center justify-between py-3 mb-1">
            <h2 className="text-white font-semibold text-base">Daily check-in</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm transition-colors">
              Close
            </button>
          </div>

          <div className="space-y-6">
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
              {trackStoolHealth && (
                <RatingRow
                  signal="stoolHealth"
                  value={stoolHealth}
                  onChange={setStoolHealth}
                  ratingLabels={STOOL_LABELS}
                  colorFn={(v) => v === 3 ? "text-lime-400" : v === 2 || v === 4 ? "text-amber-400" : "text-red-400"}
                />
              )}
              <RatingRow signal="hunger" value={hunger} onChange={setHunger} />
            </div>

            {/* Optional notes */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to add? (optional)"
              rows={2}
              className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 resize-none"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={!compliance || saving}
              className="w-full py-3.5 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
            >
              {saving ? "Saving…" : "Save check-in"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
