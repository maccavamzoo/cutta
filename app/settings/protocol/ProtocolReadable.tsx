"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ProtocolFile, MacroRange } from "@/lib/protocol";

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

  const { rest_day, training_day, pre_ride, on_bike, post_ride, race_week } = protocol;

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
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
      </Section>

      {/* Rest day */}
      <Section title="Rest day">
        <Row label="Calories"  value={formatCalorieRule(rest_day.calorie_offset, rest_day.add_training_burn)} />
        <Row label="Carbs"     value={formatRange(rest_day.carbs_g_per_kg, "g/kg")} />
        <Row label="Protein"   value={formatRange(rest_day.protein_g_per_kg, "g/kg")} />
        <Row label="Fat"       value={formatRange(rest_day.fat_g_per_kg, "g/kg")} />
      </Section>

      {/* Training day */}
      <Section title="Training day">
        <Row label="Calories"  value={formatCalorieRule(training_day.calorie_offset, training_day.add_training_burn)} />
        <Row label="Carbs"     value={formatRange(training_day.carbs_g_per_kg, "g/kg")} />
        <Row label="Protein"   value={formatRange(training_day.protein_g_per_kg, "g/kg")} />
        <Row label="Fat"       value={formatRange(training_day.fat_g_per_kg, "g/kg")} />
      </Section>

      {/* Pre-ride */}
      <Section title="Pre-ride">
        <Row label="Timing" value={`${pre_ride.timing_hours_before} hrs before`} />
        <Row label="Focus"  value={pre_ride.focus} />
      </Section>

      {/* On-bike fuelling */}
      <Section title="On-bike fuelling">
        <Row
          label="Under 90 min"
          value={
            on_bike.under_90min_carbs_per_hour === 0
              ? "Water and electrolytes only"
              : `${on_bike.under_90min_carbs_per_hour} g carbs/hr`
          }
        />
        <Row label="90 min – 3 hrs" value={formatRange(on_bike.over_90min_carbs_per_hour, "g carbs/hr")} />
        <Row label="Over 3 hrs"     value={formatRange(on_bike.over_3hrs_carbs_per_hour, "g carbs/hr")} />
      </Section>

      {/* Post-ride */}
      <Section title="Post-ride">
        <Row label="Timing"   value={`Within ${post_ride.timing_minutes_after} min`} />
        <Row label="Protein"  value={`${post_ride.protein_g_per_kg} g/kg`} />
        <Row label="Carbs"    value={`${post_ride.carbs_g_per_kg} g/kg`} />
        <Row label="Focus"    value={post_ride.focus} />
      </Section>

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
