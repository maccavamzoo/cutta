"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { kgToDisplay, displayToKg, weightLabel, weightInputRange, type UnitSystem } from "@/lib/units";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  targetWeightKg:               number | null;
  typicalWeeklyHours:           string | null;
  fastedTraining:               boolean | null;
  gutSensitivity:               string | null;
  foodExclusions:               string[] | null;
  currentSupplements:           string[] | null;
  appetiteProfile:              string | null;
  preferredMealTiming:          string | null;
  estimatedMaintenanceCalories: number | null;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? "bg-lime-400 border-lime-400 text-black"
          : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim().replace(/,$/, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-200 text-sm rounded-lg"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-zinc-500 hover:text-white ml-1"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
          }}
          placeholder={placeholder}
          className="flex-1 bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-2.5 bg-zinc-700 text-white rounded-xl text-sm hover:bg-zinc-600 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-white text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ProfileEditView({
  initial,
  unitSystem = "metric",
}: {
  initial: ProfileData;
  unitSystem?: UnitSystem;
}) {
  const router = useRouter();
  const wLabel = weightLabel(unitSystem);
  const wRange = weightInputRange(unitSystem);

  const [targetWeightStr, setTargetWeightStr] = useState(
    initial.targetWeightKg != null
      ? String(kgToDisplay(initial.targetWeightKg, unitSystem))
      : ""
  );
  const [weeklyHours,     setWeeklyHours]     = useState(initial.typicalWeeklyHours ?? "");
  const [fastedTraining,  setFastedTraining]  = useState(
    initial.fastedTraining === true ? "yes" : initial.fastedTraining === false ? "no" : "sometimes"
  );
  const [gutSensitivity,  setGutSensitivity]  = useState(initial.gutSensitivity ?? "");
  const [foodExclusions,  setFoodExclusions]  = useState<string[]>(initial.foodExclusions ?? []);
  const [supplements,     setSupplements]     = useState<string[]>(initial.currentSupplements ?? []);
  const [appetiteProfile, setAppetiteProfile] = useState(initial.appetiteProfile ?? "");
  const [mealTiming,      setMealTiming]      = useState(initial.preferredMealTiming ?? "");
  const [maintenanceCals, setMaintenanceCals] = useState(
    initial.estimatedMaintenanceCalories ? String(initial.estimatedMaintenanceCalories) : ""
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  const FASTED_OPTS = [{ v: "yes", l: "Yes" }, { v: "sometimes", l: "Sometimes" }, { v: "no", l: "No" }];
  const GUT_OPTS        = [
    { v: "low",    l: "Low — rarely an issue" },
    { v: "medium", l: "Medium — occasional issues" },
    { v: "high",   l: "High — frequent problems" },
  ];
  const MEAL_TIMING_OPTS = [
    { v: "3 meals + snacks", l: "3 meals + snacks" },
    { v: "3 meals only",     l: "3 meals only" },
    { v: "2 meals + snacks", l: "2 meals + snacks" },
    { v: "grazing",          l: "Grazing / frequent small meals" },
  ];

  async function handleSave() {
    const displayTarget = targetWeightStr.trim() ? parseFloat(targetWeightStr.trim()) : null;
    if (displayTarget !== null && (isNaN(displayTarget) || displayTarget < wRange.min || displayTarget > wRange.max)) {
      setError(`Enter a valid target weight (${wRange.min}–${wRange.max} ${wLabel}).`);
      return;
    }
    const targetWeightKg = displayTarget !== null ? displayToKg(displayTarget, unitSystem) : null;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/user-profile/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWeightKg,
          typicalWeeklyHours:           weeklyHours       || null,
          fastedTraining,
          gutSensitivity:               gutSensitivity    || null,
          foodExclusions,
          currentSupplements:           supplements,
          appetiteProfile:              appetiteProfile   || null,
          preferredMealTiming:          mealTiming        || null,
          estimatedMaintenanceCalories: maintenanceCals   || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save.");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-32">

      {/* Goal */}
      <Section title="Goal">
        <Field label={`Target weight (${wLabel})`}>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step={wRange.step}
              min={wRange.min}
              max={wRange.max}
              placeholder={unitSystem === "imperial" ? "e.g. 155" : "e.g. 70.0"}
              value={targetWeightStr}
              onChange={(e) => setTargetWeightStr(e.target.value)}
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">{wLabel}</span>
          </div>
        </Field>
        <Field label="Estimated maintenance calories (kcal/day)">
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 2400"
            value={maintenanceCals}
            onChange={(e) => setMaintenanceCals(e.target.value)}
            className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
          />
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* Training */}
      <Section title="Training">
        <Field label="Typical weekly training hours">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max="40"
            placeholder="e.g. 8"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
            className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
          />
        </Field>
        <Field label="Train fasted?">
          <div className="flex gap-2">
            {FASTED_OPTS.map(({ v, l }) => (
              <Pill key={v} label={l} active={fastedTraining === v} onClick={() => setFastedTraining(v)} />
            ))}
          </div>
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* Gut & food */}
      <Section title="Gut health & food">
        <Field label="Gut sensitivity">
          <div className="space-y-2">
            {GUT_OPTS.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setGutSensitivity(v)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  gutSensitivity === v
                    ? "bg-lime-400 border-lime-400 text-black font-medium"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Food exclusions">
          <TagInput
            tags={foodExclusions}
            onChange={setFoodExclusions}
            placeholder="e.g. Gluten, Dairy, Eggs…"
          />
        </Field>
        <Field label="Current supplements">
          <TagInput
            tags={supplements}
            onChange={setSupplements}
            placeholder="e.g. Creatine, Vitamin D…"
          />
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* Appetite */}
      <Section title="Appetite & timing">
        <Field label="Appetite profile">
          <textarea
            value={appetiteProfile}
            onChange={(e) => setAppetiteProfile(e.target.value)}
            placeholder="e.g. Large appetite, prefer big dinners, not hungry in the mornings"
            rows={3}
            className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800 resize-none"
          />
        </Field>
        <Field label="Preferred meal timing">
          <div className="space-y-2">
            {MEAL_TIMING_OPTS.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setMealTiming(v)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  mealTiming === v
                    ? "bg-lime-400 border-lime-400 text-black font-medium"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {saved && <p className="text-lime-400 text-sm font-medium">Changes saved ✓</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-lime-400 text-black font-bold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
