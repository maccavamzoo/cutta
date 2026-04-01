"use client";

import { useState } from "react";
import { PROTOCOL_TEMPLATES } from "@/lib/protocol-templates";

export default function TemplatePicker({
  activeProtocolName,
  onActivated,
}: {
  activeProtocolName: string | null;
  onActivated: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(
    PROTOCOL_TEMPLATES.find((t) => t.protocol_name === activeProtocolName)?.protocol_name ?? null
  );
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const isDifferentFromActive = selected !== null && selected !== activeProtocolName;

  async function activate() {
    if (!selected || !isDifferentFromActive) return;
    const template = PROTOCOL_TEMPLATES.find((t) => t.protocol_name === selected);
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/protocol", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(template),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to activate protocol.");
        return;
      }
      onActivated();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {PROTOCOL_TEMPLATES.map((t) => {
          const isSelected = selected === t.protocol_name;
          return (
            <button
              key={t.protocol_name}
              type="button"
              onClick={() => setSelected(t.protocol_name)}
              className={`text-left rounded-xl px-4 py-3 border transition-colors ${
                isSelected
                  ? "border-lime-400 bg-lime-400/5"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <p className="text-white font-semibold text-sm leading-snug">{t.protocol_name}</p>
              {t.description && (
                <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{t.description}</p>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isDifferentFromActive && (
        <button
          type="button"
          onClick={activate}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-lime-400 text-black font-semibold text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
        >
          {saving ? "Activating…" : "Use this protocol"}
        </button>
      )}
    </div>
  );
}
