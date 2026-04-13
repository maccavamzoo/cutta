"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { kgToDisplay, displayToKg, weightLabel, weightInputRange, type UnitSystem } from "@/lib/units";
import BottomNav from "@/components/BottomNav";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  currentWeightKg:              number | null;
  targetWeightKg:               number | null;
  heightCm:                     number | null;
  age:                          number | null;
  sex:                          string | null;
  weightLossRate:               string | null;
  targetSetAt:                  string | null;
  appetiteProfile:              string | null;
  estimatedMaintenanceCalories: number | null;
}

// ─── calorie calculation (Mifflin-St Jeor) ────────────────────────────────────

function calcMaintenance(
  weightKg: number | null,
  heightCm: number | null,
  age:      number | null,
  sex:      string,
): number | null {
  if (!weightKg || !heightCm || !age) return null;
  const bmr =
    sex === "male"   ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : sex === "female" ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    :                    10 * weightKg + 6.25 * heightCm - 5 * age - 78;
  // Sedentary multiplier — the AI fuelling plan adds activity burn per day
  // based on actual calendar events (duration, intensity, power).
  return Math.round(bmr * 1.2);
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
  mode = "edit",
  backHref,
}: {
  initial:    ProfileData;
  unitSystem?: UnitSystem;
  mode?:      "onboarding" | "edit";
  backHref?:  string;
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

  // ── weight loss rate ─────────────────────────────────────────────────────
  const [weightLossRate, setWeightLossRate] = useState(initial.weightLossRate ?? "moderate");

  // ── maintenance calories (auto-calc + optional override) ─────────────────
  const currentWeightKgParsed = currentWeightStr ? displayToKg(parseFloat(currentWeightStr), unitSystem) : null;
  const calculatedCals = useMemo(
    () => calcMaintenance(currentWeightKgParsed, parseFloat(heightStr) || null, parseFloat(ageStr) || null, sex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWeightStr, heightStr, ageStr, sex, unitSystem]
  );

  const [overrideActive,   setOverrideActive]   = useState(false);
  const [overrideCalsStr,  setOverrideCalsStr]   = useState(
    initial.estimatedMaintenanceCalories != null ? String(initial.estimatedMaintenanceCalories) : ""
  );

  // ── eating style ─────────────────────────────────────────────────────────
  const MEAL_PATTERNS = [
    "3 big meals, no snacking",
    "3 meals + evening snack",
    "Big breakfast, lighter evening",
    "Light morning, big dinner",
    "Grazing (5 smaller meals)",
  ] as const;

  const DEFAULT_MEAL_PATTERN = "3 meals + evening snack";

  const [mealPattern, setMealPattern] = useState<string>(
    MEAL_PATTERNS.includes(initial.appetiteProfile?.split(", ")[0] as typeof MEAL_PATTERNS[number])
      ? initial.appetiteProfile!.split(", ")[0]
      : DEFAULT_MEAL_PATTERN
  );
  const [doneBy7, setDoneBy7] = useState<boolean>(
    initial.appetiteProfile?.includes("Done eating by 7pm") ?? false
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  // ── unsaved changes guard ────────────────────────────────────────────────
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    const initCurrentWeight  = initial.currentWeightKg != null ? String(kgToDisplay(initial.currentWeightKg, unitSystem)) : "";
    const initTargetWeight   = initial.targetWeightKg  != null ? String(kgToDisplay(initial.targetWeightKg,  unitSystem)) : "";
    const initHeight         = initial.heightCm != null ? String(initial.heightCm) : "";
    const initAge            = initial.age      != null ? String(initial.age)      : "";
    const initSex            = initial.sex      ?? "";
    const initWeightLossRate = initial.weightLossRate ?? "moderate";
    const initMealPattern    = MEAL_PATTERNS.includes(initial.appetiteProfile?.split(", ")[0] as typeof MEAL_PATTERNS[number])
      ? initial.appetiteProfile!.split(", ")[0]
      : DEFAULT_MEAL_PATTERN;
    const initDoneBy7        = initial.appetiteProfile?.includes("Done eating by 7pm") ?? false;
    const initOverrideCals   = initial.estimatedMaintenanceCalories != null ? String(initial.estimatedMaintenanceCalories) : "";

    if (currentWeightStr !== initCurrentWeight)  return true;
    if (targetWeightStr  !== initTargetWeight)   return true;
    if (heightStr        !== initHeight)         return true;
    if (ageStr           !== initAge)            return true;
    if (sex              !== initSex)            return true;
    if (weightLossRate   !== initWeightLossRate) return true;
    if (mealPattern      !== initMealPattern)    return true;
    if (doneBy7          !== initDoneBy7)        return true;
    if (overrideActive && overrideCalsStr !== initOverrideCals)  return true;
    if (!overrideActive && initOverrideCals !== "" && overrideCalsStr !== initOverrideCals) return true;
    return false;
  }, [currentWeightStr, targetWeightStr, heightStr, ageStr, sex, weightLossRate,
      mealPattern, doneBy7, overrideActive, overrideCalsStr, initial, unitSystem]);

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

    // Record when the goal target changes (rate change alone doesn't reset the anchor)
    const goalChanged = targetWeightKg !== initial.targetWeightKg;

    const payload = {
      currentWeightKg,
      targetWeightKg,
      heightCm:                     heightStr ? Number(heightStr) : null,
      age:                          ageStr    ? Number(ageStr)    : null,
      sex:                          sex       || null,
      weightLossRate,
      ...(goalChanged ? { targetSetAt: new Date().toISOString() } : {}),
      appetiteProfile:              doneBy7 ? `${mealPattern}, Done eating by 7pm` : mealPattern,
      estimatedMaintenanceCalories,
    };

    try {
      if (mode === "onboarding") {
        const res = await fetch("/api/onboarding", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Failed to save.");
        }
        router.push("/dashboard");
      } else {
        const res = await fetch("/api/user-profile/profile", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Failed to save.");
        }
        setSaved(true);
        if (pendingNavigation) {
          window.location.href = pendingNavigation;
        } else {
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleNavigation(href: string): boolean {
    if (isDirty) {
      setPendingNavigation(href);
      return false;
    }
    return true;
  }

  return (
    <>
    {/* Unsaved changes modal */}
    {pendingNavigation && (
      <>
        <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setPendingNavigation(null)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">You have unsaved changes</p>
            <p className="text-zinc-400 text-sm">Would you like to save before leaving?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400 text-black disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & leave"}
              </button>
              <button
                type="button"
                onClick={() => router.push(pendingNavigation)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-300"
              >
                Discard
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingNavigation(null)}
              className="w-full text-center text-zinc-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    )}

    <div className="space-y-8 pb-32">

      {mode === "edit" && backHref && (
        <div className="flex items-center gap-3 -mt-2 mb-0">
          <button
            type="button"
            onClick={() => isDirty ? setPendingNavigation(backHref) : router.push(backHref)}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Settings
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Edit profile</h1>
            <p className="text-zinc-500 text-sm">Update your training habits and food preferences.</p>
          </div>
        </div>
      )}

      {mode === "onboarding" && (
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to Cutta</h1>
          <p className="text-zinc-500 text-sm mt-1">Set up your profile to get your first fuelling plan.</p>
        </div>
      )}

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

        <Field label="Weight loss rate">
          <p className="text-zinc-500 text-xs -mt-1 mb-2">How quickly do you want to reach your target?</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "aggressive",   l: "Aggressive",   sub: "~0.75–1 kg/week"   },
              { v: "moderate",     l: "Moderate",     sub: "~0.4–0.6 kg/week"  },
              { v: "conservative", l: "Conservative", sub: "~0.2–0.3 kg/week"  },
              { v: "maintain",     l: "Maintain",     sub: "No deficit"         },
            ] as const).map(({ v, l, sub }) => (
              <button
                key={v} type="button" onClick={() => setWeightLossRate(v)}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  weightLossRate === v
                    ? "bg-lime-400 border-lime-400 text-black"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <span className="font-medium block">{l}</span>
                <span className={`text-xs block mt-0.5 ${weightLossRate === v ? "text-black/60" : "text-zinc-500"}`}>{sub}</span>
              </button>
            ))}
          </div>
        </Field>

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
              ? "Calories to maintain your weight at rest. Training burn is added when you log activities."
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

      </Section>

      <div className="border-t border-zinc-800" />

      {/* 3 — Eating style */}
      <Section title="Eating style">
        <div className="space-y-4">
          <p className="text-zinc-500 text-xs">How do you prefer to structure your meals?</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_PATTERNS.map((opt) => (
              <Pill key={opt} label={opt} active={mealPattern === opt} onClick={() => setMealPattern(opt)} />
            ))}
          </div>
          <div className="pt-2">
            <p className="text-zinc-600 text-xs mb-2">Modifier</p>
            <Pill
              label="Done eating by 7pm"
              active={doneBy7}
              onClick={() => setDoneBy7((prev) => !prev)}
            />
          </div>
        </div>
      </Section>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {saved && !isDirty && <p className="text-lime-400 text-sm font-medium">Changes saved ✓</p>}

      <button
        type="button" onClick={handleSave} disabled={saving || (mode === "edit" && !isDirty)}
        className="w-full py-4 bg-lime-400 text-black font-bold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
      >
        {saving
          ? (mode === "onboarding" ? "Setting up…" : "Saving…")
          : (mode === "onboarding" ? "Get started →" : "Save changes")}
      </button>
    </div>

    {mode === "edit" && <BottomNav active="settings" onNavigate={handleNavigation} />}
    </>
  );
}
