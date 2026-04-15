"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ProtocolFile, ActivityType } from "@/lib/protocol";

// ─── primitives ─────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      {children}
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

function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
      aria-label="Why is fat auto-calculated?"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 6.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="4.25" r="0.8" fill="currentColor" />
      </svg>
    </button>
  );
}

const FAT_INFO_TEXT =
  "Fat is the flex macro. Protein and carbs are set from your protocol \u2014 fat fills the remaining calories to hit your daily target. This means fat adjusts automatically based on your activity level and calorie goal.";

// ─── ActivityCard ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  fatInfoOpen,
  onToggleFatInfo,
}: {
  activity: ActivityType;
  fatInfoOpen: boolean;
  onToggleFatInfo: () => void;
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
          <Row label="Burn rate">
            <span className="text-sm text-right text-zinc-200">{activity.burn_rate_kcal_per_min} kcal/min</span>
          </Row>
          <Row label="Carbs">
            <span className="text-sm text-right text-zinc-200">{activity.carbs_g_per_kg} g/kg</span>
          </Row>
          <Row label="Protein">
            <span className="text-sm text-right text-zinc-200">{activity.protein_g_per_kg} g/kg</span>
          </Row>
          <Row label="Fat">
            <span className="flex items-center gap-1.5 text-sm text-zinc-500">
              Auto-calculated
              <InfoButton onClick={onToggleFatInfo} />
            </span>
          </Row>
          {fatInfoOpen && (
            <div className="bg-black/50 rounded-xl px-4 py-3 border border-white/5 mt-1 mb-1">
              <p className="text-zinc-500 text-xs leading-relaxed">{FAT_INFO_TEXT}</p>
            </div>
          )}
          <Row label="Pre-activity">
            <span className="text-sm text-right text-zinc-200">
              {activity.pre_activity.timing_hours_before} hrs before — {activity.pre_activity.focus}
            </span>
          </Row>
          <Row label="During">
            <span className="text-sm text-right text-zinc-200">
              {activity.during_activity
                ? `${activity.during_activity.carbs_per_hour}g carbs/hr — ${activity.during_activity.description}`
                : "No during-activity fuelling"}
            </span>
          </Row>
          <Row label="Post-activity">
            <span className="text-sm text-right text-zinc-200">
              {`Within ${activity.post_activity.timing_minutes_after} min — ` +
                `${activity.post_activity.protein_g_per_kg}g/kg protein, ` +
                `${activity.post_activity.carbs_g_per_kg}g/kg carbs — ` +
                activity.post_activity.focus}
            </span>
          </Row>
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
  // Shared state: which fat info popup is open. null = none, "rest" = rest day, number = activity index
  const [fatInfoOpen, setFatInfoOpen] = useState<string | number | null>(null);

  const { rest_day, activity_types } = protocol;

  function toggleFatInfo(id: string | number) {
    setFatInfoOpen((prev) => (prev === id ? null : id));
  }

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
        <Row label="Activated">
          <span className="text-sm text-right text-zinc-200">
            {activatedAt.toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </Row>
      </Section>

      {/* Rest day */}
      <Section title="Rest day macros">
        <Row label="Carbs">
          <span className="text-sm text-right text-zinc-200">{rest_day.carbs_g_per_kg} g/kg</span>
        </Row>
        <Row label="Protein">
          <span className="text-sm text-right text-zinc-200">{rest_day.protein_g_per_kg} g/kg</span>
        </Row>
        <Row label="Fat">
          <span className="flex items-center gap-1.5 text-sm text-zinc-500">
            Auto-calculated
            <InfoButton onClick={() => toggleFatInfo("rest")} />
          </span>
        </Row>
        {fatInfoOpen === "rest" && (
          <div className="bg-black/50 rounded-xl px-4 py-3 border border-white/5 mt-1">
            <p className="text-zinc-500 text-xs leading-relaxed">{FAT_INFO_TEXT}</p>
          </div>
        )}
      </Section>

      {/* Activity types */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
          Activity types
        </p>
        <div className="space-y-2">
          {activity_types.map((at, i) => (
            <ActivityCard
              key={i}
              activity={at}
              fatInfoOpen={fatInfoOpen === i}
              onToggleFatInfo={() => toggleFatInfo(i)}
            />
          ))}
        </div>
      </div>

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
          {savingTemplate ? "Saving\u2026" : "Save to my templates"}
        </button>
      )}

      {savedTemplate && (
        <p className="text-lime-400 text-xs">Saved to your templates.</p>
      )}
    </div>
  );
}
