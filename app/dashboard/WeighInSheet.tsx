"use client";

import { useState } from "react";
import { kgToDisplay, displayToKg, weightLabel, weightInputRange, type UnitSystem } from "@/lib/units";

interface Props {
  latestWeightKg:   number | null;
  latestBodyFatPct: number | null;
  unitSystem?:      UnitSystem;
  onClose:          () => void;
  onSaved:          (weightKg: number, bodyFatPct: number | null) => void;
}

export default function WeighInSheet({
  latestWeightKg,
  latestBodyFatPct,
  unitSystem = "metric",
  onClose,
  onSaved,
}: Props) {
  const wLabel = weightLabel(unitSystem);
  const wRange = weightInputRange(unitSystem);

  const [weightStr, setWeightStr] = useState(
    latestWeightKg != null ? String(kgToDisplay(latestWeightKg, unitSystem)) : ""
  );
  const [bfStr,    setBfStr]    = useState(
    latestBodyFatPct != null ? String(latestBodyFatPct) : ""
  );
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    const displayVal = weightStr.trim() ? parseFloat(weightStr.trim()) : null;
    if (displayVal === null) return;

    if (isNaN(displayVal) || displayVal < wRange.min || displayVal > wRange.max) {
      setError(`Enter a valid weight (${wRange.min}–${wRange.max} ${wLabel}).`);
      return;
    }
    const bodyFatPct = bfStr.trim() ? parseFloat(bfStr.trim()) : null;
    if (bodyFatPct !== null && (isNaN(bodyFatPct) || bodyFatPct < 1 || bodyFatPct > 70)) {
      setError("Enter a valid body fat % (1–70).");
      return;
    }

    const weightKg = displayToKg(displayVal, unitSystem);
    setSaving(true);
    setError(null);

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
      setSaved(true);
      onSaved(weightKg, bodyFatPct);
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
        <div className="px-4 pb-10">
          <div className="flex items-center justify-between py-3 mb-4">
            <h2 className="text-white font-semibold text-base">Morning weigh-in</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm transition-colors">
              Close
            </button>
          </div>

          <div className="flex gap-3 mb-4">
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
                  onChange={(e) => { setWeightStr(e.target.value); setSaved(false); }}
                  className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">{wLabel}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-white text-sm font-medium mb-1.5">
                Body fat <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  max="70"
                  placeholder="e.g. 14.2"
                  value={bfStr}
                  onChange={(e) => { setBfStr(e.target.value); setSaved(false); }}
                  className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">%</span>
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {saved ? (
            <p className="text-lime-400 text-sm font-medium">Weigh-in saved ✓</p>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!weightStr.trim() || saving}
              className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
            >
              {saving ? "Saving…" : "Save weigh-in"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
