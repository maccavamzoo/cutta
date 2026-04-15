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

// ─── Creation form ───────────────────────────────────────────────────────────

function CreateForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [burnRate, setBurnRate] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");

  // Pre-activity
  const [preTiming, setPreTiming] = useState("2");
  const [preFocus, setPreFocus] = useState("");

  // During
  const [duringEnabled, setDuringEnabled] = useState(true);
  const [duringCarbs, setDuringCarbs] = useState("");
  const [duringDesc, setDuringDesc] = useState("");

  // Post-activity
  const [postTiming, setPostTiming] = useState("30");
  const [postFocus, setPostFocus] = useState("");
  const [postProtein, setPostProtein] = useState("0.3");
  const [postCarbs, setPostCarbs] = useState("0.8");

  // Other
  const [defaultDuration, setDefaultDuration] = useState("60");
  const [isRace, setIsRace] = useState(false);

  async function handleSave() {
    setError(null);

    if (!name.trim()) { setError("Name is required."); return; }
    if (!burnRate || isNaN(Number(burnRate))) { setError("Burn rate is required."); return; }
    if (!carbs || isNaN(Number(carbs))) { setError("Carbs g/kg is required."); return; }
    if (!protein || isNaN(Number(protein))) { setError("Protein g/kg is required."); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        burnRateKcalPerMin: Number(burnRate),
        carbsGPerKg: Number(carbs),
        proteinGPerKg: Number(protein),
        preActivity: {
          timing_hours_before: Number(preTiming) || 2,
          focus: preFocus.trim() || "Moderate carbs, low fibre",
        },
        duringActivity: duringEnabled
          ? { carbs_per_hour: Number(duringCarbs) || 40, description: duringDesc.trim() || "Drink mix or gels" }
          : null,
        postActivity: {
          timing_minutes_after: Number(postTiming) || 30,
          focus: postFocus.trim() || "Protein and carbs for recovery",
          protein_g_per_kg: Number(postProtein) || 0.3,
          carbs_g_per_kg: Number(postCarbs) || 0.8,
        },
        defaultDurationMinutes: Number(defaultDuration) || 60,
        isRace,
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

  function handleConfigureWithAI() {
    const parts: string[] = ["I want to create a new activity type. Here's what I have so far:"];
    if (name.trim()) parts.push(`Name: ${name.trim()}`);
    if (description.trim()) parts.push(`Description: ${description.trim()}`);
    if (burnRate) parts.push(`Burn rate: ${burnRate} kcal/min`);
    if (carbs) parts.push(`Carbs: ${carbs} g/kg`);
    if (protein) parts.push(`Protein: ${protein} g/kg`);
    if (preTiming !== "2" || preFocus.trim()) parts.push(`Pre-activity: ${preTiming} hrs before${preFocus.trim() ? ` — ${preFocus.trim()}` : ""}`);
    if (duringEnabled && duringCarbs) parts.push(`During: ${duringCarbs} g/hr carbs${duringDesc.trim() ? ` — ${duringDesc.trim()}` : ""}`);
    if (!duringEnabled) parts.push("During: no fuelling during activity");
    if (postTiming !== "30" || postFocus.trim()) parts.push(`Post-activity: ${postTiming} min after${postFocus.trim() ? ` — ${postFocus.trim()}` : ""}`);
    if (postProtein !== "0.3") parts.push(`Post protein: ${postProtein} g/kg`);
    if (postCarbs !== "0.8") parts.push(`Post carbs: ${postCarbs} g/kg`);
    if (defaultDuration !== "60") parts.push(`Default duration: ${defaultDuration} min`);
    if (isRace) parts.push("This is a race-type activity");

    parts.push("\nHelp me figure out the right values for the remaining fields.");

    const msg = parts.join("\n");
    window.location.href = `/advisor?prefill=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-1">
      <p className="text-white text-sm font-semibold pb-1">New activity type</p>

      {/* Core fields */}
      <SectionLabel>Basics</SectionLabel>
      <div className="space-y-2">
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Name</label>
          <TextInput value={name} onChange={setName} placeholder="e.g. Hard ride, Gym session" />
        </div>
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Description</label>
          <TextInput value={description} onChange={setDescription} placeholder="e.g. Intervals, threshold work" />
        </div>
      </div>

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

      {/* Pre-activity */}
      <SectionLabel>Pre-activity</SectionLabel>
      <FormField label="Timing" suffix="hrs before">
        <NumInput value={preTiming} onChange={setPreTiming} step="0.5" min="0.5" max="4" />
      </FormField>
      <div>
        <label className="text-zinc-400 text-sm block mb-1">Focus</label>
        <TextInput value={preFocus} onChange={setPreFocus} placeholder="e.g. High carb, low fibre" />
      </div>

      {/* During */}
      <SectionLabel>During activity</SectionLabel>
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={duringEnabled}
          onChange={(e) => setDuringEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-lime-400 focus:ring-lime-400/30"
        />
        <span className="text-zinc-300 text-sm">Fuelling during activity</span>
      </label>
      {duringEnabled && (
        <>
          <FormField label="Carbs" suffix="g/hr">
            <NumInput value={duringCarbs} onChange={setDuringCarbs} min="0" max="120" placeholder="40" />
          </FormField>
          <div>
            <label className="text-zinc-400 text-sm block mb-1">Description</label>
            <TextInput value={duringDesc} onChange={setDuringDesc} placeholder="e.g. Gels and drink mix" />
          </div>
        </>
      )}

      {/* Post-activity */}
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

      {/* Other */}
      <SectionLabel>Other</SectionLabel>
      <FormField label="Default duration" suffix="min">
        <NumInput value={defaultDuration} onChange={setDefaultDuration} min="10" max="480" inputMode="numeric" />
      </FormField>
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isRace}
          onChange={(e) => setIsRace(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-lime-400 focus:ring-lime-400/30"
        />
        <span className="text-zinc-300 text-sm">This is a race-type activity</span>
      </label>

      {error && <p className="text-red-400 text-xs pt-1">{error}</p>}

      <div className="pt-3 space-y-2">
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
          onClick={handleConfigureWithAI}
          className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors"
        >
          Configure with AI &rarr;
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

        {/* Pills row */}
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.id}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300"
            >
              {item.name}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              formOpen
                ? "border-lime-400 bg-lime-400/10 text-lime-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            +
          </button>
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

        {/* Add/customise via AI */}
        <p className="text-zinc-600 text-xs text-center">
          Need help choosing values?{" "}
          <button
            type="button"
            onClick={() => window.location.href = "/advisor?prefill=" + encodeURIComponent("Help me create a new activity type for my training.")}
            className="text-lime-600 hover:text-lime-400 transition-colors"
          >
            Chat with Cutta AI &rarr;
          </button>
        </p>
      </div>

      <BottomNav active="settings" />
    </>
  );
}
