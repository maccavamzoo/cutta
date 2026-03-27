"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { kgToDisplay, displayToKg, weightLabel, weightInputRange, type UnitSystem } from "@/lib/units";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  currentWeightKg:              number | null;
  targetWeightKg:               number | null;
  heightCm:                     number | null;
  age:                          number | null;
  sex:                          string | null;
  typicalWeeklyHours:           string | null;
  fastedTraining:               boolean | null;
  gutSensitivity:               string | null;
  foodExclusions:               string[] | null;
  currentSupplements:           string[] | null;
  appetiteProfile:              string | null;
  preferredMealTiming:          string | null;
  estimatedMaintenanceCalories: number | null;
}

// ─── calorie calculation (Mifflin-St Jeor) ────────────────────────────────────

function calcMaintenance(
  weightKg:    number | null,
  heightCm:    number | null,
  age:         number | null,
  sex:         string,
  weeklyHours: string,
): number | null {
  if (!weightKg || !heightCm || !age) return null;
  const bmr =
    sex === "male"   ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : sex === "female" ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    :                    10 * weightKg + 6.25 * heightCm - 5 * age - 78;
  const h    = parseFloat(weeklyHours) || 0;
  const mult = h < 3 ? 1.375 : h < 6 ? 1.55 : h < 10 ? 1.725 : 1.9;
  return Math.round(bmr * mult);
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
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-200 text-sm rounded-lg">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-zinc-500 hover:text-white ml-1">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="flex-1 bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
        />
        <button type="button" onClick={addTag} className="px-4 py-2.5 bg-zinc-700 text-white rounded-xl text-sm hover:bg-zinc-600 transition-colors">Add</button>
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
  const router  = useRouter();
  const wLabel  = weightLabel(unitSystem);
  const wRange  = weightInputRange(unitSystem);

  // ── body stats ───────────────────────────────────────────────────────────
  const [currentWeightStr, setCurrentWeightStr] = useState(
    initial.currentWeightKg != null ? String(kgToDisplay(initial.currentWeightKg, unitSystem)) : ""
  );
  const [targetWeightStr, setTargetWeightStr] = useState(
    initial.targetWeightKg != null ? String(kgToDisplay(initial.targetWeightKg, unitSystem)) : ""
  );
  const [heightStr, setHeightStr] = useState(initial.heightCm != null ? String(initial.heightCm) : "");
  const [ageStr,    setAgeStr]    = useState(initial.age != null ? String(initial.age) : "");
  const [sex,       setSex]       = useState(initial.sex ?? "");

  // ── training ─────────────────────────────────────────────────────────────
  const [weeklyHours,    setWeeklyHours]    = useState(initial.typicalWeeklyHours ?? "");
  const [fastedTraining, setFastedTraining] = useState(
    initial.fastedTraining === true ? "yes" : initial.fastedTraining === false ? "no" : "sometimes"
  );

  // ── maintenance calories (auto-calc + optional override) ─────────────────
  const currentWeightKgParsed = currentWeightStr ? displayToKg(parseFloat(currentWeightStr), unitSystem) : null;
  const calculatedCals = useMemo(
    () => calcMaintenance(currentWeightKgParsed, parseFloat(heightStr) || null, parseFloat(ageStr) || null, sex, weeklyHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWeightStr, heightStr, ageStr, sex, weeklyHours, unitSystem]
  );

  const [overrideActive,   setOverrideActive]   = useState(initial.estimatedMaintenanceCalories !== null);
  const [overrideCalsStr,  setOverrideCalsStr]   = useState(
    initial.estimatedMaintenanceCalories != null ? String(initial.estimatedMaintenanceCalories) : ""
  );

  // ── gut & food ────────────────────────────────────────────────────────────
  const [gutSensitivity, setGutSensitivity] = useState(initial.gutSensitivity ?? "");
  const [foodExclusions, setFoodExclusions] = useState<string[]>(initial.foodExclusions ?? []);
  const [supplements,    setSupplements]    = useState<string[]>(initial.currentSupplements ?? []);

  // ── appetite ──────────────────────────────────────────────────────────────
  const [appetiteProfile, setAppetiteProfile] = useState(initial.appetiteProfile ?? "");
  const [mealTiming,      setMealTiming]      = useState(initial.preferredMealTiming ?? "");

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  const FASTED_OPTS = [
    { v: "yes",       l: "Yes"       },
    { v: "sometimes", l: "Sometimes" },
    { v: "no",        l: "No"        },
  ];

  const GUT_OPTS = [
    { v: "low",    l: "Low — rarely an issue"      },
    { v: "medium", l: "Medium — occasional issues" },
    { v: "high",   l: "High — frequent problems"   },
  ];

  const MEAL_TIMING_OPTS = [
    { v: "3 meals + snacks", l: "3 meals + snacks"             },
    { v: "3 meals only",     l: "3 meals only"                 },
    { v: "2 meals + snacks", l: "2 meals + snacks"             },
    { v: "grazing",          l: "Grazing / frequent small meals" },
  ];

  async function handleSave() {
    // Validate weights
    const dispCurrent = currentWeightStr.trim() ? parseFloat(currentWeightStr.trim()) : null;
    const dispTarget  = targetWeightStr.trim()  ? parseFloat(targetWeightStr.trim())  : null;
    if (dispCurrent !== null && (isNaN(dispCurrent) || dispCurrent < wRange.min || dispCurrent > wRange.max)) {
      setError(`Enter a valid current weight (${wRange.min}–${wRange.max} ${wLabel}).`);
      return;
    }
    if (dispTarget !== null && (isNaN(dispTarget) || dispTarget < wRange.min || dispTarget > wRange.max)) {
      setError(`Enter a valid target weight (${wRange.min}–${wRange.max} ${wLabel}).`);
      return;
    }

    const currentWeightKg = dispCurrent !== null ? displayToKg(dispCurrent, unitSystem) : null;
    const targetWeightKg  = dispTarget  !== null ? displayToKg(dispTarget,  unitSystem) : null;

    // Determine final calorie value: override if active, otherwise auto-calculated
    const estimatedMaintenanceCalories =
      overrideActive && overrideCalsStr
        ? Number(overrideCalsStr)
        : (calculatedCals ?? null);

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/user-profile/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentWeightKg,
          targetWeightKg,
          heightCm:                     heightStr ? Number(heightStr) : null,
          age:                          ageStr    ? Number(ageStr)    : null,
          sex:                          sex       || null,
          typicalWeeklyHours:           weeklyHours       || null,
          fastedTraining,
          gutSensitivity:               gutSensitivity    || null,
          foodExclusions,
          currentSupplements:           supplements,
          appetiteProfile:              appetiteProfile   || null,
          preferredMealTiming:          mealTiming        || null,
          estimatedMaintenanceCalories,
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

      {/* 1 — Body stats */}
      <Section title="Body stats">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Current weight (${wLabel})`}>
            <div className="relative">
              <input
                type="number" inputMode="decimal" step={wRange.step} min={wRange.min} max={wRange.max}
                placeholder={unitSystem === "imperial" ? "e.g. 165" : "e.g. 75.0"}
                value={currentWeightStr} onChange={(e) => setCurrentWeightStr(e.target.value)}
                className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">{wLabel}</span>
            </div>
          </Field>
          <Field label={`Target weight (${wLabel})`}>
            <div className="relative">
              <input
                type="number" inputMode="decimal" step={wRange.step} min={wRange.min} max={wRange.max}
                placeholder={unitSystem === "imperial" ? "e.g. 155" : "e.g. 70.0"}
                value={targetWeightStr} onChange={(e) => setTargetWeightStr(e.target.value)}
                className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">{wLabel}</span>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)">
            <div className="relative">
              <input
                type="number" inputMode="numeric" min="100" max="250"
                placeholder="e.g. 178"
                value={heightStr} onChange={(e) => setHeightStr(e.target.value)}
                className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">cm</span>
            </div>
          </Field>
          <Field label="Age">
            <input
              type="number" inputMode="numeric" min="16" max="100"
              placeholder="e.g. 35"
              value={ageStr} onChange={(e) => setAgeStr(e.target.value)}
              className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
            />
          </Field>
        </div>

        <Field label="Sex">
          <div className="flex gap-2">
            {["male", "female", "other"].map((s) => (
              <Pill key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={sex === s} onClick={() => setSex(s)} />
            ))}
          </div>
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* 2 — Daily energy */}
      <Section title="Daily energy">
        {/* Auto-calculated maintenance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4">
          <p className="text-zinc-500 text-xs mb-1">Estimated daily maintenance</p>
          <p className="text-white text-2xl font-bold tabular-nums">
            {calculatedCals != null ? calculatedCals.toLocaleString() : "—"}
            <span className="text-zinc-500 text-sm font-normal ml-1">kcal</span>
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            {calculatedCals != null
              ? "Calculated from your stats (Mifflin-St Jeor)"
              : "Fill in weight, height, age and sex to calculate"}
          </p>
        </div>

        {/* Override toggle */}
        {!overrideActive ? (
          <button
            type="button"
            onClick={() => {
              setOverrideActive(true);
              if (!overrideCalsStr && calculatedCals) setOverrideCalsStr(String(calculatedCals));
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
          >
            Override manually →
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white text-sm font-medium">Manual override (kcal/day)</label>
              <button
                type="button"
                onClick={() => { setOverrideActive(false); setOverrideCalsStr(""); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Use calculated ×
              </button>
            </div>
            <div className="relative">
              <input
                type="number" inputMode="numeric" min="800" max="6000"
                placeholder={calculatedCals ? String(calculatedCals) : "e.g. 2400"}
                value={overrideCalsStr} onChange={(e) => setOverrideCalsStr(e.target.value)}
                className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">kcal</span>
            </div>
          </div>
        )}

        <Field label="Typical weekly training hours">
          <input
            type="number" inputMode="decimal" step="0.5" min="0" max="40"
            placeholder="e.g. 8"
            value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)}
            className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800"
          />
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* 3 — Training habits */}
      <Section title="Training habits">
        <Field label="Train fasted?">
          <div className="flex gap-2">
            {FASTED_OPTS.map(({ v, l }) => (
              <Pill key={v} label={l} active={fastedTraining === v} onClick={() => setFastedTraining(v)} />
            ))}
          </div>
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* 4 — Gut health & food */}
      <Section title="Gut health & food">
        <Field label="Gut sensitivity">
          <div className="space-y-2">
            {GUT_OPTS.map(({ v, l }) => (
              <button
                key={v} type="button" onClick={() => setGutSensitivity(v)}
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
          <TagInput tags={foodExclusions} onChange={setFoodExclusions} placeholder="e.g. Gluten, Dairy, Eggs…" />
        </Field>
        <Field label="Current supplements">
          <TagInput tags={supplements} onChange={setSupplements} placeholder="e.g. Creatine, Vitamin D…" />
        </Field>
      </Section>

      <div className="border-t border-zinc-800" />

      {/* 5 — Appetite & timing */}
      <Section title="Appetite & timing">
        <Field label="Appetite profile">
          <textarea
            value={appetiteProfile} onChange={(e) => setAppetiteProfile(e.target.value)}
            placeholder="e.g. Large appetite, prefer big dinners, not hungry in the mornings"
            rows={3}
            className="w-full bg-zinc-900 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 border border-zinc-800 resize-none"
          />
        </Field>
        <Field label="Preferred meal timing">
          <div className="space-y-2">
            {MEAL_TIMING_OPTS.map(({ v, l }) => (
              <button
                key={v} type="button" onClick={() => setMealTiming(v)}
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
        type="button" onClick={handleSave} disabled={saving}
        className="w-full py-4 bg-lime-400 text-black font-bold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
