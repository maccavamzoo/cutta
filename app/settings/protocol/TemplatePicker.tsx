"use client";

import React, { useState } from "react";
import { PROTOCOL_TEMPLATES } from "@/lib/protocol-templates";
import type { SavedTemplate } from "./ProtocolPageShell";

interface Props {
  activeProtocolName: string | null;
  savedTemplates: SavedTemplate[];
  onActivated: () => void;
  onDeleted: () => void;
}

export default function TemplatePicker({
  activeProtocolName,
  savedTemplates,
  onActivated,
  onDeleted,
}: Props) {
  const [selected, setSelected] = useState<string | null>(
    PROTOCOL_TEMPLATES.find((t) => t.protocol_name === activeProtocolName)?.protocol_name ??
      savedTemplates.find((t) => t.name === activeProtocolName)?.name ??
      null
  );
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const isDifferentFromActive = selected !== null && selected !== activeProtocolName;

  async function activate() {
    if (!selected || !isDifferentFromActive) return;

    const builtIn = PROTOCOL_TEMPLATES.find((t) => t.protocol_name === selected);
    const saved   = savedTemplates.find((t) => t.name === selected);
    const content = builtIn ?? saved?.content;
    if (!content) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/protocol", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(content),
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

  async function deleteTemplate(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/protocol/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to remove template.");
        return;
      }
      // Clear selection if we just deleted the selected template
      const deleted = savedTemplates.find((t) => t.id === id);
      if (deleted && selected === deleted.name) setSelected(null);
      onDeleted();
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Built-in templates */}
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

      {/* Saved (user) templates */}
      {savedTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Your templates
          </p>
          <div className="grid grid-cols-2 gap-3">
            {savedTemplates.map((t) => {
              const isSelected = selected === t.name;
              const isDeleting = deleting === t.id;
              return (
                <div key={t.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelected(t.name)}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-colors pr-8 ${
                      isSelected
                        ? "border-lime-400 bg-lime-400/5"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <p className="text-white font-semibold text-sm leading-snug">{t.name}</p>
                  </button>
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent) => deleteTemplate(t.id, e)}
                    disabled={isDeleting}
                    aria-label={`Remove ${t.name} template`}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
                  >
                    {isDeleting ? (
                      <span className="w-2.5 h-2.5 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs leading-none">×</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
