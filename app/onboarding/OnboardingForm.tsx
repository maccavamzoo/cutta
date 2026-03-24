"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  // Step 0 — Body stats
  currentWeightKg: string;
  targetWeightKg: string;
  heightCm: string;
  age: string;
  sex: string;
  // Step 1 — Training baseline
  typicalWeeklyHours: string;
  sessionTypes: string[];
  usualIntensity: string;
  // Step 2 — Training habits
  fastedTraining: string; // "yes" | "sometimes" | "no"
  trainingTimePreference: string;
  trainingEnvironment: string;
  // Step 3 — Calorie baseline
  estimatedMaintenanceCalories: string;
  usualCarbIntakeGrams: string;
  // Step 4 — Gut health
  gutSensitivity: string;
  foodExclusions: string[];
  // Step 5 — Appetite & timing
  appetiteProfile: string[];
  preferredMealTiming: string;
  // Step 6 — Supplements
  currentSupplements: string[];
};

const INITIAL: FormData = {
  currentWeightKg: "",
  targetWeightKg: "",
  heightCm: "",
  age: "",
  sex: "",
  typicalWeeklyHours: "",
  sessionTypes: [],
  usualIntensity: "",
  fastedTraining: "",
  trainingTimePreference: "",
  trainingEnvironment: "",
  estimatedMaintenanceCalories: "",
  usualCarbIntakeGrams: "",
  gutSensitivity: "",
  foodExclusions: [],
  appetiteProfile: [],
  preferredMealTiming: "",
  currentSupplements: [],
};

const TOTAL_STEPS = 7;

// ─── Calorie Estimation ───────────────────────────────────────────────────────

function calcMaintenance(data: FormData): number {
  const weight = parseFloat(data.currentWeightKg);
  const height = parseFloat(data.heightCm);
  const age = parseFloat(data.age);
  const hours = parseFloat(data.typicalWeeklyHours);
  if (!weight || !height || !age) return 0;

  // Mifflin-St Jeor
  const bmr =
    data.sex === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : data.sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age - 78; // average for "other"

  const multiplier =
    !hours || hours < 3 ? 1.375 : hours < 6 ? 1.55 : hours < 10 ? 1.725 : 1.9;

  return Math.round(bmr * multiplier);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? "bg-lime-400 border-lime-400 text-black"
          : "bg-zinc-900 border-zinc-700 text-zinc-300 active:bg-zinc-800"
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
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700 font-medium"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-zinc-400 hover:text-white leading-none text-base"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  unit,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit?: string;
  decimal?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400 ${unit ? "pr-12" : ""}`}
        />
        {unit && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type StepProps = { data: FormData; onChange: (patch: Partial<FormData>) => void };

function StepBodyStats({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 1 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Let&apos;s start with you</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          Your stats calibrate your fuelling plan
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Current weight"
          value={data.currentWeightKg}
          onChange={(v) => onChange({ currentWeightKg: v })}
          placeholder="78"
          unit="kg"
          decimal
        />
        <NumberField
          label="Target weight"
          value={data.targetWeightKg}
          onChange={(v) => onChange({ targetWeightKg: v })}
          placeholder="72"
          unit="kg"
          decimal
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Height"
          value={data.heightCm}
          onChange={(v) => onChange({ heightCm: v })}
          placeholder="175"
          unit="cm"
        />
        <NumberField
          label="Age"
          value={data.age}
          onChange={(v) => onChange({ age: v })}
          placeholder="35"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Sex
        </label>
        <div className="flex gap-3">
          {["male", "female", "other"].map((s) => (
            <Pill
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              active={data.sex === s}
              onClick={() => onChange({ sex: s })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepTraining({ data, onChange }: StepProps) {
  const toggleSession = (type: string) => {
    const next = data.sessionTypes.includes(type)
      ? data.sessionTypes.filter((t) => t !== type)
      : [...data.sessionTypes, type];
    onChange({ sessionTypes: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 2 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Your training</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          We&apos;ll build your fuelling plan around your sessions
        </p>
      </div>

      <NumberField
        label="Typical hours per week"
        value={data.typicalWeeklyHours}
        onChange={(v) => onChange({ typicalWeeklyHours: v })}
        placeholder="8"
        unit="hrs"
        decimal
      />

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Session types
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "road", label: "Road" },
            { value: "indoor", label: "Indoor / Rouvy" },
            { value: "track", label: "Track" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.sessionTypes.includes(value)}
              onClick={() => toggleSession(value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Usual intensity
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "easy", label: "Easy / Z2" },
            { value: "moderate", label: "Moderate" },
            { value: "hard", label: "Hard / Intervals" },
            { value: "mixed", label: "Mixed" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.usualIntensity === value}
              onClick={() => onChange({ usualIntensity: value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepTrainingHabits({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 3 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Training habits</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          These shape your nutrition timing
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Do you train fasted?
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "yes", label: "Yes — regularly" },
            { value: "sometimes", label: "Sometimes" },
            { value: "no", label: "No — always fuelled" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.fastedTraining === value}
              onClick={() => onChange({ fastedTraining: value })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          When do you usually train?
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "morning", label: "Morning" },
            { value: "lunchtime", label: "Lunchtime" },
            { value: "evening", label: "Evening" },
            { value: "flexible", label: "Flexible / varies" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.trainingTimePreference === value}
              onClick={() => onChange({ trainingTimePreference: value })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Where do you mainly train?
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "outdoor", label: "Outdoor" },
            { value: "indoor", label: "Indoor" },
            { value: "mixed", label: "Both" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.trainingEnvironment === value}
              onClick={() => onChange({ trainingEnvironment: value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCalorieBaseline({
  data,
  onChange,
  calculatedCals,
}: StepProps & { calculatedCals: number }) {
  useEffect(() => {
    if (!data.estimatedMaintenanceCalories && calculatedCals > 0) {
      onChange({ estimatedMaintenanceCalories: String(calculatedCals) });
    }
    // Only auto-fill when the calculated value changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedCals]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 4 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Calorie baseline</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          Estimated from your stats — adjust if you know your numbers
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Estimated maintenance calories
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={data.estimatedMaintenanceCalories}
            onChange={(e) =>
              onChange({ estimatedMaintenanceCalories: e.target.value })
            }
            placeholder={calculatedCals > 0 ? String(calculatedCals) : "2500"}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400 pr-14"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
            kcal
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Mifflin-St Jeor × activity factor. Edit if you know your actual TDEE.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Usual daily carb intake
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={data.usualCarbIntakeGrams}
            onChange={(e) => onChange({ usualCarbIntakeGrams: e.target.value })}
            placeholder="200"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400 pr-8"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
            g
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          A rough estimate is fine — helps avoid a dramatic day-one shift.
        </p>
      </div>
    </div>
  );
}

function StepGutHealth({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 5 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Gut health</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          What doesn&apos;t work for you on the bike or off it
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Gut sensitivities
        </label>
        <textarea
          value={data.gutSensitivity}
          onChange={(e) => onChange({ gutSensitivity: e.target.value })}
          rows={4}
          placeholder="e.g. Bloating after high-fibre meals, lactose intolerant, can't handle gels on long efforts, IBS flare-ups..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400 resize-none text-sm leading-relaxed"
        />
        <p className="text-xs text-zinc-500">Leave blank if no known issues.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Food exclusions
        </label>
        <p className="text-xs text-zinc-500">
          Hard exclusions — the AI will never include these in your plan.
        </p>
        <TagInput
          tags={data.foodExclusions}
          onChange={(tags) => onChange({ foodExclusions: tags })}
          placeholder="Type and press Enter — e.g. Eggs, dairy..."
        />
      </div>
    </div>
  );
}

function StepAppetite({ data, onChange }: StepProps) {
  const PROFILE_OPTIONS = [
    "Big breakfast person",
    "Small breakfast / not hungry in the morning",
    "Prefer snacking throughout the day",
    "Prefer 3 solid meals",
    "Late eater — main meal in the evening",
    "Done eating by 7pm",
    "Large portions",
    "Small portions",
  ];

  const toggleProfile = (option: string) => {
    const next = data.appetiteProfile.includes(option)
      ? data.appetiteProfile.filter((o) => o !== option)
      : [...data.appetiteProfile, option];
    onChange({ appetiteProfile: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 6 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">How you eat</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          Your habits shape how we structure your meals
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Appetite profile
        </label>
        <p className="text-xs text-zinc-500 mb-3">Select all that apply.</p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_OPTIONS.map((option) => (
            <Pill
              key={option}
              label={option}
              active={data.appetiteProfile.includes(option)}
              onClick={() => toggleProfile(option)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Pre-training meal timing
        </label>
        <p className="text-xs text-zinc-500 mb-3">
          When do you typically eat before a session?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { value: "3h", label: "2–3 hours before training" },
            { value: "2h", label: "1–2 hours before training" },
            { value: "1h", label: "Under 1 hour before training" },
            { value: "flexible", label: "Flexible / no real preference" },
          ].map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={data.preferredMealTiming === value}
              onClick={() => onChange({ preferredMealTiming: value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepSupplements({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-lime-400 uppercase tracking-widest font-semibold mb-1">
          Step 7 of 7
        </p>
        <h2 className="text-2xl font-bold text-white">Supplements</h2>
        <p className="mt-1 text-zinc-400 text-sm">
          What you&apos;re currently taking — we&apos;ll track reactions too
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 uppercase tracking-wide font-medium">
          Current supplements
        </label>
        <p className="text-xs text-zinc-500 mb-2">Leave blank if none.</p>
        <TagInput
          tags={data.currentSupplements}
          onChange={(tags) => onChange({ currentSupplements: tags })}
          placeholder="Type and press Enter — e.g. Creatine, Vitamin D..."
        />
      </div>

      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mt-4">
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="text-lime-400 font-semibold">Almost done.</span> Cutta
          will use everything you&apos;ve shared to build your first fuelling plan.
          You can update any of this at any time.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const update = (patch: Partial<FormData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const calculatedCals = calcMaintenance(data);

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return !!(
          data.currentWeightKg &&
          data.targetWeightKg &&
          data.heightCm &&
          data.age &&
          data.sex
        );
      case 1:
        return !!(
          data.typicalWeeklyHours &&
          data.sessionTypes.length > 0 &&
          data.usualIntensity
        );
      case 2:
        return !!(
          data.fastedTraining &&
          data.trainingTimePreference &&
          data.trainingEnvironment
        );
      case 3:
        return !!(data.estimatedMaintenanceCalories || calculatedCals > 0);
      case 4:
        return true;
      case 5:
        return !!(data.appetiteProfile.length > 0 && data.preferredMealTiming);
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...data,
        // Auto-fill cals if user didn't touch the field
        estimatedMaintenanceCalories:
          data.estimatedMaintenanceCalories || String(calculatedCals),
        // Join multi-select array into a string for storage
        appetiteProfile: data.appetiteProfile.join(", "),
      };
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.replace("/");
    } catch {
      setError("Something went wrong — please try again.");
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepBodyStats data={data} onChange={update} />;
      case 1:
        return <StepTraining data={data} onChange={update} />;
      case 2:
        return <StepTrainingHabits data={data} onChange={update} />;
      case 3:
        return (
          <StepCalorieBaseline
            data={data}
            onChange={update}
            calculatedCals={calculatedCals}
          />
        );
      case 4:
        return <StepGutHealth data={data} onChange={update} />;
      case 5:
        return <StepAppetite data={data} onChange={update} />;
      case 6:
        return <StepSupplements data={data} onChange={update} />;
    }
  };

  return (
    <div className="relative bg-black text-white min-h-screen">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur px-4 pt-3 pb-4 border-b border-zinc-900">
        <div className="flex gap-1 max-w-lg mx-auto">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-lime-400" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="px-4 pt-8 pb-36 max-w-lg mx-auto">{renderStep()}</div>

      {/* Error message */}
      {error && (
        <div className="fixed bottom-28 left-4 right-4 max-w-lg mx-auto z-20">
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-black/95 backdrop-blur border-t border-zinc-900 px-4 py-4 safe-area-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-4 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm active:bg-zinc-900 transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={
              step === TOTAL_STEPS - 1
                ? handleSubmit
                : () => setStep((s) => s + 1)
            }
            disabled={!canAdvance() || loading}
            className={`flex-1 py-4 rounded-xl font-bold text-sm transition-colors ${
              canAdvance() && !loading
                ? "bg-lime-400 text-black active:bg-lime-300"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {step === TOTAL_STEPS - 1
              ? loading
                ? "Setting up…"
                : "Get started →"
              : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
