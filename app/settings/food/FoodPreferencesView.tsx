"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

// ─── types ────────────────────────────────────────────────────────────────────

export interface FoodPreferencesData {
  trackStoolHealth:   boolean;
  foodExclusions:     string[] | null;
  preferredFoods:     string[] | null;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags:        string[];
  onChange:    (tags: string[]) => void;
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

function Field({ label, subtitle, children }: { label: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-white text-sm font-medium">{label}</label>
      {subtitle && <p className="text-zinc-500 text-xs -mt-1">{subtitle}</p>}
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function FoodPreferencesView({
  initial,
  backHref,
}: {
  initial:  FoodPreferencesData;
  backHref: string;
}) {
  const router = useRouter();

  const [trackStoolHealth, setTrackStoolHealth] = useState(initial.trackStoolHealth);
  const [foodExclusions,   setFoodExclusions]   = useState<string[]>(initial.foodExclusions ?? []);
  const [preferredFoods,   setPreferredFoods]   = useState<string[]>(initial.preferredFoods ?? []);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (trackStoolHealth !== initial.trackStoolHealth)                return true;
    if (JSON.stringify(foodExclusions)  !== JSON.stringify(initial.foodExclusions  ?? [])) return true;
    if (JSON.stringify(preferredFoods)  !== JSON.stringify(initial.preferredFoods  ?? [])) return true;
    return false;
  }, [trackStoolHealth, foodExclusions, preferredFoods, initial]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/user-profile/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackStoolHealth,
          foodExclusions,
          preferredFoods,
        }),
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
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => isDirty ? setPendingNavigation(backHref) : router.push(backHref)}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Settings
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Gut health &amp; food preferences</h1>
          <p className="text-zinc-500 text-sm">Foods to avoid and preferred foods.</p>
        </div>

        {/* Track stool health */}
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Track stool health</p>
            <p className="text-zinc-600 text-xs mt-0.5 leading-relaxed">
              Log stool consistency in your daily check-in. Helps the AI spot gut issues and adjust your plan.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={trackStoolHealth}
            onClick={() => setTrackStoolHealth((x) => !x)}
            className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors ${
              trackStoolHealth ? "bg-lime-400" : "bg-zinc-700"
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              trackStoolHealth ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        <div className="border-t border-zinc-800" />

        {/* Foods to avoid */}
        <Field label="Foods to avoid">
          <TagInput tags={foodExclusions} onChange={setFoodExclusions} placeholder="e.g. Gluten, Dairy, Pasta..." />
        </Field>

        {/* Preferred foods */}
        <div className="space-y-2">
          <label className="block text-white text-sm font-medium">Preferred foods</label>
          <p className="text-zinc-500 text-xs">Foods that work well for you. The AI will favour these in your plans.</p>
          <TagInput tags={preferredFoods} onChange={setPreferredFoods} placeholder="e.g. Rice, Chicken, Banana..." />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {saved && !isDirty && <p className="text-lime-400 text-sm font-medium">Changes saved ✓</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="w-full py-4 bg-lime-400 text-black font-bold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <BottomNav active="settings" onNavigate={handleNavigation} />
    </>
  );
}
