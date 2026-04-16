"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ActivityTypeItem {
  id: number;
  name: string;
  description: string;
  burnRateKcalPerMin: number;
  carbsGPerKg: number;
  proteinGPerKg: number;
  preActivity: { timing_hours_before: number; focus: string };
  duringActivity: { carbs_per_hour: number; description: string } | null;
  postActivity: { timing_minutes_after: number; focus: string; protein_g_per_kg: number; carbs_g_per_kg: number };
  defaultDurationMinutes: number;
  isRace: boolean;
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({
  item,
  onDelete,
  deleting,
}: {
  item: ActivityTypeItem;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 text-left flex items-start justify-between gap-3"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-sm font-medium">{item.name}</p>
            {item.isRace && (
              <span className="text-xs px-1.5 py-0.5 bg-orange-400/10 text-orange-400 border border-orange-400/30 rounded-full">
                Race
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs mt-0.5">{item.description}</p>
        </div>
        <span className="text-zinc-600 text-sm shrink-0 pt-0.5">{open ? "▼" : "▲"}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-zinc-800">
          <Row label="Burn rate">
            <span className="text-sm text-right text-zinc-200">{item.burnRateKcalPerMin} kcal/min</span>
          </Row>
          <Row label="Carbs">
            <span className="text-sm text-right text-zinc-200">{item.carbsGPerKg} g/kg</span>
          </Row>
          <Row label="Protein">
            <span className="text-sm text-right text-zinc-200">{item.proteinGPerKg} g/kg</span>
          </Row>
          <Row label="Fat">
            <span className="text-sm text-zinc-500">Auto-calculated</span>
          </Row>
          <Row label="Pre-activity">
            <span className="text-sm text-right text-zinc-200">
              {item.preActivity.timing_hours_before} hrs before — {item.preActivity.focus}
            </span>
          </Row>
          <Row label="During">
            <span className="text-sm text-right text-zinc-200">
              {item.duringActivity
                ? `${item.duringActivity.carbs_per_hour}g carbs/hr — ${item.duringActivity.description}`
                : "No during-activity fuelling"}
            </span>
          </Row>
          <Row label="Post-activity">
            <span className="text-sm text-right text-zinc-200">
              {`Within ${item.postActivity.timing_minutes_after} min — ` +
                `${item.postActivity.protein_g_per_kg}g/kg protein, ` +
                `${item.postActivity.carbs_g_per_kg}g/kg carbs — ` +
                item.postActivity.focus}
            </span>
          </Row>
          <Row label="Default duration">
            <span className="text-sm text-right text-zinc-200">{item.defaultDurationMinutes} min</span>
          </Row>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deleting}
              className="text-red-400 text-xs hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Delete activity type
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form input helpers ──────────────────────────────────────────────────────

function FormField({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label className="text-zinc-400 text-sm shrink-0">{label}</label>
      <div className="flex items-center gap-2">
        {children}
        {suffix && <span className="text-zinc-500 text-xs shrink-0 w-16 text-right">{suffix}</span>}
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step,
  min,
  max,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      inputMode={inputMode ?? "decimal"}
      className="w-20 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 text-right outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-500 text-xs uppercase tracking-wider pt-3 pb-1">{children}</p>;
}

// ─── Intensity presets ───────────────────────────────────────────────────────

type Intensity = "Easy" | "Moderate" | "Hard" | "Race";

const INTENSITY_PRESETS: Record<Intensity, {
  burn_rate_kcal_per_min: number;
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
  pre_timing_hours_before: number;
  pre_focus: string;
  during_carbs_per_hour: number;
  during_description: string;
  post_timing_minutes_after: number;
  post_focus: string;
  post_protein_g_per_kg: number;
  post_carbs_g_per_kg: number;
  default_duration_minutes: number;
  is_race: boolean;
  fuel_during: boolean;
}> = {
  Easy: {
    burn_rate_kcal_per_min: 5,
    carbs_g_per_kg: 3,
    protein_g_per_kg: 1.8,
    pre_timing_hours_before: 1.5,
    pre_focus: "Light meal, easy to digest",
    during_carbs_per_hour: 0,
    during_description: "Water and electrolytes only",
    post_timing_minutes_after: 45,
    post_focus: "Normal meal timing is fine",
    post_protein_g_per_kg: 0.3,
    post_carbs_g_per_kg: 0.6,
    default_duration_minutes: 60,
    is_race: false,
    fuel_during: false,
  },
  Moderate: {
    burn_rate_kcal_per_min: 8,
    carbs_g_per_kg: 5,
    protein_g_per_kg: 1.8,
    pre_timing_hours_before: 2,
    pre_focus: "Moderate carbs, low fibre",
    during_carbs_per_hour: 40,
    during_description: "Drink mix or gels",
    post_timing_minutes_after: 30,
    post_focus: "Protein and carbs for recovery",
    post_protein_g_per_kg: 0.3,
    post_carbs_g_per_kg: 0.8,
    default_duration_minutes: 75,
    is_race: false,
    fuel_during: true,
  },
  Hard: {
    burn_rate_kcal_per_min: 11,
    carbs_g_per_kg: 7,
    protein_g_per_kg: 1.8,
    pre_timing_hours_before: 2.5,
    pre_focus: "High carb, low fibre, moderate protein",
    during_carbs_per_hour: 60,
    during_description: "Gels, bars, or drink mix",
    post_timing_minutes_after: 30,
    post_focus: "Protein and carbs within recovery window",
    post_protein_g_per_kg: 0.3,
    post_carbs_g_per_kg: 1.0,
    default_duration_minutes: 90,
    is_race: false,
    fuel_during: true,
  },
  Race: {
    burn_rate_kcal_per_min: 12,
    carbs_g_per_kg: 9,
    protein_g_per_kg: 1.6,
    pre_timing_hours_before: 3,
    pre_focus: "High carb, low fibre, familiar foods only",
    during_carbs_per_hour: 80,
    during_description: "Practised race nutrition",
    post_timing_minutes_after: 20,
    post_focus: "Rapid glycogen replenishment",
    post_protein_g_per_kg: 0.3,
    post_carbs_g_per_kg: 1.2,
    default_duration_minutes: 120,
    is_race: true,
    fuel_during: true,
  },
};

const INTENSITIES: Intensity[] = ["Easy", "Moderate", "Hard", "Race"];

// ─── Creation form ───────────────────────────────────────────────────────────

function CreateForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visible fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [defaultDuration, setDefaultDuration] = useState("");
  const [fuelDuring, setFuelDuring] = useState(false);
  const [duringCarbs, setDuringCarbs] = useState("");

  // Advanced (hidden by default, pre-filled from preset)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [burnRate, setBurnRate] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [preTiming, setPreTiming] = useState("");
  const [preFocus, setPreFocus] = useState("");
  const [duringDesc, setDuringDesc] = useState("");
  const [postTiming, setPostTiming] = useState("");
  const [postFocus, setPostFocus] = useState("");
  const [postProtein, setPostProtein] = useState("");
  const [postCarbs, setPostCarbs] = useState("");

  function handleIntensityChange(i: Intensity) {
    setIntensity(i);
    const p = INTENSITY_PRESETS[i];
    // Fill all values from preset
    setDefaultDuration(String(p.default_duration_minutes));
    setFuelDuring(p.fuel_during);
    setDuringCarbs(p.fuel_during ? String(p.during_carbs_per_hour) : "");
    setBurnRate(String(p.burn_rate_kcal_per_min));
    setCarbs(String(p.carbs_g_per_kg));
    setProtein(String(p.protein_g_per_kg));
    setPreTiming(String(p.pre_timing_hours_before));
    setPreFocus(p.pre_focus);
    setDuringDesc(p.during_description);
    setPostTiming(String(p.post_timing_minutes_after));
    setPostFocus(p.post_focus);
    setPostProtein(String(p.post_protein_g_per_kg));
    setPostCarbs(String(p.post_carbs_g_per_kg));
  }

  async function handleSave() {
    setError(null);

    if (!name.trim()) { setError("Name is required."); return; }
    if (!intensity) { setError("Pick an intensity."); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        burnRateKcalPerMin: Number(burnRate) || 8,
        carbsGPerKg: Number(carbs) || 5,
        proteinGPerKg: Number(protein) || 1.8,
        preActivity: {
          timing_hours_before: Number(preTiming) || 2,
          focus: preFocus || "Moderate carbs, low fibre",
        },
        duringActivity: fuelDuring
          ? { carbs_per_hour: Number(duringCarbs) || 40, description: duringDesc || "Drink mix or gels" }
          : null,
        postActivity: {
          timing_minutes_after: Number(postTiming) || 30,
          focus: postFocus || "Protein and carbs for recovery",
          protein_g_per_kg: Number(postProtein) || 0.3,
          carbs_g_per_kg: Number(postCarbs) || 0.8,
        },
        defaultDurationMinutes: Number(defaultDuration) || 60,
        isRace: intensity === "Race",
      };

      const res = await fetch("/api/activity-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Failed to save.");
        return;
      }

      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <p className="text-white text-sm font-semibold">New activity type</p>

      {/* Name */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">Name</label>
        <TextInput value={name} onChange={setName} placeholder="e.g. Hard ride, Gym session" />
      </div>

      {/* Description */}
      <div>
        <label className="text-zinc-400 text-sm block mb-1">Description</label>
        <TextInput value={description} onChange={setDescription} placeholder="e.g. Intervals, hill reps" />
      </div>

      {/* Intensity pills */}
      <div>
        <label className="text-zinc-400 text-sm block mb-2">Intensity</label>
        <div className="flex gap-2">
          {INTENSITIES.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleIntensityChange(i)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                intensity === i
                  ? "bg-lime-400 text-black"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <FormField label="Default duration" suffix="min">
        <NumInput value={defaultDuration} onChange={setDefaultDuration} min="10" max="480" inputMode="numeric" placeholder="60" />
      </FormField>

      {/* Fuel during toggle + carbs/hr */}
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={fuelDuring}
          onChange={(e) => setFuelDuring(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-lime-400 focus:ring-lime-400/30"
        />
        <span className="text-zinc-300 text-sm">Fuel during activity</span>
      </label>
      {fuelDuring && (
        <FormField label="Carbs during" suffix="g/hr">
          <NumInput value={duringCarbs} onChange={setDuringCarbs} min="0" max="120" placeholder="40" />
        </FormField>
      )}

      {/* Advanced settings */}
      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors pt-1"
      >
        {advancedOpen ? "Hide advanced settings" : "Advanced settings \u2192"}
      </button>

      {advancedOpen && (
        <div className="space-y-1 border-t border-zinc-800 pt-2">
          <SectionLabel>Day macros</SectionLabel>
          <FormField label="Burn rate" suffix="kcal/min">
            <NumInput value={burnRate} onChange={setBurnRate} step="0.5" min="1" max="20" placeholder="8" />
          </FormField>
          <FormField label="Carbs" suffix="g/kg">
            <NumInput value={carbs} onChange={setCarbs} step="0.5" min="1" max="12" placeholder="5" />
          </FormField>
          <FormField label="Protein" suffix="g/kg">
            <NumInput value={protein} onChange={setProtein} step="0.1" min="1" max="3" placeholder="1.8" />
          </FormField>
          <div className="flex items-center justify-between py-2">
            <span className="text-zinc-400 text-sm">Fat</span>
            <span className="text-zinc-500 text-sm">Auto-calculated</span>
          </div>

          <SectionLabel>Pre-activity</SectionLabel>
          <FormField label="Timing" suffix="hrs before">
            <NumInput value={preTiming} onChange={setPreTiming} step="0.5" min="0.5" max="4" />
          </FormField>
          <div>
            <label className="text-zinc-400 text-sm block mb-1">Focus</label>
            <TextInput value={preFocus} onChange={setPreFocus} placeholder="e.g. High carb, low fibre" />
          </div>

          {fuelDuring && (
            <>
              <SectionLabel>During activity</SectionLabel>
              <div>
                <label className="text-zinc-400 text-sm block mb-1">Description</label>
                <TextInput value={duringDesc} onChange={setDuringDesc} placeholder="e.g. Gels and drink mix" />
              </div>
            </>
          )}

          <SectionLabel>Post-activity</SectionLabel>
          <FormField label="Timing" suffix="min after">
            <NumInput value={postTiming} onChange={setPostTiming} min="10" max="120" inputMode="numeric" />
          </FormField>
          <div>
            <label className="text-zinc-400 text-sm block mb-1">Focus</label>
            <TextInput value={postFocus} onChange={setPostFocus} placeholder="e.g. Protein and carbs for recovery" />
          </div>
          <FormField label="Protein" suffix="g/kg">
            <NumInput value={postProtein} onChange={setPostProtein} step="0.1" min="0.1" max="1" />
          </FormField>
          <FormField label="Carbs" suffix="g/kg">
            <NumInput value={postCarbs} onChange={setPostCarbs} step="0.1" min="0.1" max="2" />
          </FormField>
        </div>
      )}

      {error && <p className="text-red-400 text-xs pt-1">{error}</p>}

      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-lime-400 text-black text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving..." : "Save activity type"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityTypesView({ initial }: { initial: ActivityTypeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formOpen && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [formOpen]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this activity type?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activity-types/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  function handleCreated() {
    // Full page reload to get fresh data from the server
    window.location.reload();
  }

  return (
    <>
      <div className="space-y-6 pb-20">
        <div>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            &larr; Settings
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Activity types</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Define your training activity types. The AI uses these to calculate macro targets and fuelling plans.
          </p>
        </div>

        {/* Create new */}
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Create new activity type</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              className={`text-xs px-4 py-1.5 rounded-full border transition-colors font-medium ${
                formOpen
                  ? "border-lime-400 bg-lime-400/10 text-lime-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/advisor?prefill=" + encodeURIComponent("I want to create a new activity type for my training. Walk me through it \u2014 ask me what kind of activity it is and help me set the right values. When we\u2019re done, save it."); }}
              className="text-xs px-4 py-1.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors font-medium"
            >
              AI &#10022;
            </button>
          </div>
        </div>

        {/* Creation form */}
        {formOpen && (
          <div ref={formRef}>
            <CreateForm
              onCreated={handleCreated}
              onClose={() => setFormOpen(false)}
            />
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <ActivityCard key={item.id} item={item} onDelete={handleDelete} deleting={deleting} />
          ))}

          {items.length === 0 && !formOpen && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">No activity types yet.</p>
            </div>
          )}
        </div>


      </div>

      <BottomNav active="settings" />
    </>
  );
}
