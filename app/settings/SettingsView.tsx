"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UnitSystem } from "@/lib/units";

export default function SettingsView({ unitSystem }: { unitSystem: UnitSystem }) {
  const [current, setCurrent] = useState<UnitSystem>(unitSystem);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggle(val: UnitSystem) {
    if (val === current || saving) return;
    setSaving(true);
    try {
      await fetch("/api/user-profile/units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitSystem: val }),
      });
      setCurrent(val);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Units</p>
      <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {(["metric", "imperial"] as UnitSystem[]).map((val) => (
          <button
            key={val}
            onClick={() => toggle(val)}
            disabled={saving}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              current === val
                ? "bg-lime-400 text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {val === "metric" ? "Metric (kg, km)" : "Imperial (lbs, mi)"}
          </button>
        ))}
      </div>
      <p className="text-zinc-600 text-xs">
        {current === "metric"
          ? "Weights shown in kg. Distances in km."
          : "Weights shown in lbs. Distances in miles."}
      </p>
    </div>
  );
}
