"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityTypesView({ initial }: { initial: ActivityTypeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <>
      <div className="space-y-6 pb-20">
        <div>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Settings
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Activity types</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Define your training activity types. The AI uses these to calculate macro targets and fuelling plans.
          </p>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <ActivityCard key={item.id} item={item} onDelete={handleDelete} deleting={deleting} />
          ))}

          {items.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">No activity types yet.</p>
            </div>
          )}
        </div>

        {/* Add/customise via AI */}
        <p className="text-zinc-600 text-xs text-center">
          Want to add or customise?{" "}
          <Link href="/advisor" className="text-lime-600 hover:text-lime-400 transition-colors">
            Chat with Cutta AI →
          </Link>
        </p>
      </div>

      <BottomNav active="settings" />
    </>
  );
}
