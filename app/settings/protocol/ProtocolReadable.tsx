"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ProtocolFile, MacroRange, ActivityType } from "@/lib/protocol";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCalorieRule(offset: number, addTrainingBurn: boolean): string {
  let base: string;
  if (offset === 0) {
    base = "Maintenance";
  } else if (offset > 0) {
    base = `Maintenance + ${offset} kcal`;
  } else {
    base = `Maintenance \u2212 ${Math.abs(offset)} kcal`;
  }
  if (addTrainingBurn) base += " + training burn";
  return base;
}

function formatRange(range: MacroRange, unit: string): string {
  if (range.min === range.max) return `${range.min} ${unit}`;
  return `${range.min}\u2013${range.max} ${unit}`;
}

// ─── primitives ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      <span className="text-zinc-200 text-sm text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── ActivityCard ────────────────────────────────────────────────────────────

function ActivityCard({ activity }: { activity: ActivityType }) {
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
            <p className="text-white text-sm font-medium">{activity.name}</p>
            {activity.is_race && (
              <span className="text-xs px-1.5 py-0.5 bg-orange-400/10 text-orange-400 border border-orange-400/30 rounded-full">
                Race
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs mt-0.5">{activity.description}</p>
        </div>
        <span className="text-zinc-600 text-sm shrink-0 pt-0.5">{open ? "▼" : "▲"}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-zinc-800">
          <Row
            label="Calories"
            value={formatCalorieRule(activity.calorie_offset, activity.add_training_burn)}
          />
          <Row label="Burn rate"  value={`${activity.burn_rate_kcal_per_min} kcal/min`} />
          <Row label="Carbs"      value={formatRange(activity.carbs_g_per_kg, "g/kg")} />
          <Row label="Protein"    value={formatRange(activity.protein_g_per_kg, "g/kg")} />
          <Row label="Fat"        value={formatRange(activity.fat_g_per_kg, "g/kg")} />
          <Row
            label="Pre-activity"
            value={`${activity.pre_activity.timing_hours_before} hrs before — ${activity.pre_activity.focus}`}
          />
          <Row
            label="During"
            value={
              activity.during_activity
                ? `${activity.during_activity.carbs_per_hour}g carbs/hr — ${activity.during_activity.description}`
                : "No during-activity fuelling"
            }
          />
          <Row
            label="Post-activity"
            value={
              `Within ${activity.post_activity.timing_minutes_after} min — ` +
              `${activity.post_activity.protein_g_per_kg}g/kg protein, ` +
              `${activity.post_activity.carbs_g_per_kg}g/kg carbs — ` +
              activity.post_activity.focus
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

export default function ProtocolReadable({
  protocol,
  activatedAt,
  isTemplate,
}: {
  protocol: ProtocolFile;
  activatedAt: Date;
  isTemplate: boolean;
}) {
  const router = useRouter();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplate,  setSavedTemplate]  = useState(false);

  const { rest_day, activity_types, race_week } = protocol;

  async function handleSaveAsTemplate() {
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/protocol", { method: "PATCH" });
      if (res.ok) {
        setSavedTemplate(true);
        router.refresh();
      }
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className="space-y-3">

      {/* Overview */}
      <Section title="Overview">
        {protocol.description && (
          <p className="text-zinc-300 text-sm pb-2 border-b border-zinc-800 mb-0">{protocol.description}</p>
        )}
        <Row
          label="Activated"
          value={activatedAt.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })}
        />
      </Section>

      {/* Rest day */}
      <Section title="Rest day">
        <Row label="Calories" value={formatCalorieRule(rest_day.calorie_offset, false)} />
        <Row label="Carbs"    value={formatRange(rest_day.carbs_g_per_kg, "g/kg")} />
        <Row label="Protein"  value={formatRange(rest_day.protein_g_per_kg, "g/kg")} />
        <Row label="Fat"      value={formatRange(rest_day.fat_g_per_kg, "g/kg")} />
      </Section>

      {/* Activity types */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
          Activity types
        </p>
        <div className="space-y-2">
          {activity_types.map((at, i) => (
            <ActivityCard key={i} activity={at} />
          ))}
        </div>
      </div>

      {/* Race week */}
      <Section title="Race week">
        <Row label="Carb load starts" value={`${race_week.carb_load_days_before} days before`} />
        <Row label="Carb load target" value={formatRange(race_week.carb_load_g_per_kg, "g/kg")} />
        <Row
          label="Race morning"
          value={`${race_week.race_morning_carbs_g_per_kg} g/kg, ${race_week.race_morning_hours_before} hrs before`}
        />
        <Row label="Strategy" value={race_week.strategy_notes} />
      </Section>

      {/* Save to my templates — only if not already a template */}
      {!isTemplate && !savedTemplate && (
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          disabled={savingTemplate}
          className="flex items-center gap-2 text-zinc-500 text-xs hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
            <path d="M5 2v4h6V2M5 11h6" />
          </svg>
          {savingTemplate ? "Saving…" : "Save to my templates"}
        </button>
      )}

      {savedTemplate && (
        <p className="text-lime-400 text-xs">Saved to your templates.</p>
      )}
    </div>
  );
}
