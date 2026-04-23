"use client";

import { useState } from "react";

export interface CalendarEvent {
  id:              number;
  title:           string;
  eventType:       string;
  scheduledAt:     string;
  durationMinutes: number | null;
  notes:           string | null;
}

export interface ActivityTypeOption {
  name:                     string;
  description:              string;
  default_duration_minutes: number;
  carbs_g_per_kg:           number;
  protein_g_per_kg:         number;
}

interface Props {
  defaultDate:   Date;
  activityTypes: ActivityTypeOption[];
  onClose:       () => void;
  onAdded:       (event: CalendarEvent) => void;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddEventSheet({ defaultDate, activityTypes, onClose, onAdded }: Props) {
  const firstType = activityTypes[0]?.name ?? "rest";

  const [title,     setTitle]     = useState("");
  const [eventType, setEventType] = useState(firstType);
  const [datetime,  setDatetime]  = useState(toDatetimeLocal(defaultDate));
  const [duration,  setDuration]  = useState(
    activityTypes[0] ? String(activityTypes[0].default_duration_minutes) : ""
  );
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function handleTypeSelect(name: string) {
    setEventType(name);
    if (name === "rest") {
      setDuration("");
    } else {
      const at = activityTypes.find(a => a.name === name);
      if (at) setDuration(String(at.default_duration_minutes));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/calendar", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:           title.trim(),
        eventType,
        scheduledAt:     new Date(datetime).toISOString(),
        durationMinutes: duration ? parseInt(duration, 10) : undefined,
        notes:           notes.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save. Try again.");
      setSaving(false);
      return;
    }

    onAdded({
      ...data.event,
      scheduledAt: typeof data.event.scheduledAt === "string"
        ? data.event.scheduledAt
        : new Date(data.event.scheduledAt).toISOString(),
    });
  }

  const allTypes: { name: string; isRest?: boolean }[] = [
    ...activityTypes.map(a => ({ name: a.name })),
    { name: "rest", isRest: true },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl px-4 pt-3 pb-10 max-w-lg mx-auto overflow-y-auto max-h-[90dvh]">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Add session</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm transition-colors">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title"
            autoFocus
            className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
          />

          <div>
            <p className="text-xs text-zinc-500 mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleTypeSelect(t.name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    eventType === t.name
                      ? t.isRest
                        ? "bg-zinc-600 text-white"
                        : "bg-lime-400 text-black"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {t.isRest ? "Rest" : t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-2">Date &amp; time</p>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 [color-scheme:dark]"
            />
          </div>

          {eventType !== "rest" && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Duration (minutes)</p>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 90"
                min="1"
                max="600"
                className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400"
              />
            </div>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 resize-none"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
          >
            {saving ? "Saving…" : "Save session"}
          </button>
        </form>
      </div>
    </>
  );
}
