"use client";

import { useState, useRef, useCallback } from "react";
import type { ExtractionResult } from "@/app/api/training-log/extract/route";

// ─── types ───────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: number;
  title: string;
  scheduledAt: string;
}

interface EditableFields {
  durationMinutes: string;
  distanceKm: string;
  avgPowerWatts: string;
  avgHeartRate: string;
  elevationM: string;
  estimatedCalories: string;
}

interface ManualFields {
  date: string;
  durationMinutes: string;
  distanceKm: string;
  avgPowerWatts: string;
  avgHeartRate: string;
  elevationM: string;
  estimatedCalories: string;
  notes: string;
}

type Tab = "auto" | "manual";
type Stage = "pick" | "extracting" | "review" | "linking" | "saved";

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function confidenceColour(c: number): string {
  if (c >= 80) return "text-lime-400";
  if (c >= 60) return "text-amber-400";
  return "text-red-400";
}

function confidenceBg(c: number): string {
  if (c >= 80) return "bg-lime-400/10 border-lime-400/30";
  if (c >= 60) return "bg-amber-400/10 border-amber-400/30";
  return "bg-red-400/10 border-red-400/30";
}

function confidenceLabel(c: number): string {
  if (c >= 80) return "High confidence";
  if (c >= 60) return "Moderate confidence";
  return "Low confidence — please check";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ─── sub-components ──────────────────────────────────────────────────────────

function FieldRow({
  label,
  fieldKey,
  unit,
  value,
  confidence,
  onChange,
}: {
  label: string;
  fieldKey: keyof EditableFields;
  unit: string;
  value: string;
  confidence: number | null;
  onChange: (key: keyof EditableFields, val: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            placeholder="—"
            className="bg-transparent text-white text-sm font-semibold w-24 focus:outline-none focus:border-b focus:border-lime-400 border-b border-transparent transition-colors"
          />
          <span className="text-zinc-600 text-xs">{unit}</span>
        </div>
      </div>
      {confidence !== null && (
        <div className={`text-xs font-medium tabular-nums shrink-0 ${confidenceColour(confidence)}`}>
          {confidence}%
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function UploadFlow() {
  const [tab, setTab] = useState<Tab>("auto");

  // ── auto tab state ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [fields, setFields] = useState<EditableFields>({
    durationMinutes: "",
    distanceKm: "",
    avgPowerWatts: "",
    avgHeartRate: "",
    elevationM: "",
    estimatedCalories: "",
  });
  const [activityDate, setActivityDate] = useState<string>(today());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── manual tab state ──────────────────────────────────────────────────────
  const [manualFields, setManualFields] = useState<ManualFields>({
    date: today(),
    durationMinutes: "",
    distanceKm: "",
    avgPowerWatts: "",
    avgHeartRate: "",
    elevationM: "",
    estimatedCalories: "",
    notes: "",
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaved, setManualSaved] = useState(false);

  // ── auto: file pick ───────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    const b64 = await toBase64(file);
    setImageBase64(b64);
    setImageMimeType(file.type || "image/jpeg");
  }

  // ── auto: extraction ──────────────────────────────────────────────────────

  const runExtraction = useCallback(async () => {
    if (!imageBase64) return;
    setStage("extracting");
    setError(null);

    try {
      const res = await fetch("/api/training-log/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed.");
        setStage("pick");
        return;
      }

      const ext: ExtractionResult = data.extraction;
      setExtraction(ext);

      setFields({
        durationMinutes:   ext.fields.duration_minutes.value != null   ? String(ext.fields.duration_minutes.value)   : "",
        distanceKm:        ext.fields.distance_km.value != null        ? String(ext.fields.distance_km.value)        : "",
        avgPowerWatts:     ext.fields.avg_power_watts.value != null    ? String(ext.fields.avg_power_watts.value)    : "",
        avgHeartRate:      ext.fields.avg_heart_rate.value != null     ? String(ext.fields.avg_heart_rate.value)     : "",
        elevationM:        ext.fields.elevation_m.value != null        ? String(ext.fields.elevation_m.value)        : "",
        estimatedCalories: ext.fields.estimated_calories.value != null ? String(ext.fields.estimated_calories.value) : "",
      });

      setStage("review");
    } catch {
      setError("Network error. Please try again.");
      setStage("pick");
    }
  }, [imageBase64, imageMimeType]);

  // ── auto: field editing ───────────────────────────────────────────────────

  function handleFieldChange(key: keyof EditableFields, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
  }

  // ── auto: event linking ───────────────────────────────────────────────────

  async function loadCalendarEvents() {
    if (calendarEvents !== null) {
      setStage("linking");
      return;
    }
    setLoadingEvents(true);
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const to = new Date();
    to.setDate(to.getDate() + 7);
    const res = await fetch(
      `/api/calendar?from=${from.toISOString()}&to=${to.toISOString()}`
    );
    if (res.ok) {
      const data = await res.json();
      setCalendarEvents(data.events);
    }
    setLoadingEvents(false);
    setStage("linking");
  }

  // ── auto: corrections diff ────────────────────────────────────────────────

  function buildCorrections(): Record<string, { original: number | null; corrected: number }> {
    if (!extraction) return {};
    const corrections: Record<string, { original: number | null; corrected: number }> = {};

    const fieldMap: Array<{
      key: keyof EditableFields;
      extKey: keyof ExtractionResult["fields"];
    }> = [
      { key: "durationMinutes",   extKey: "duration_minutes" },
      { key: "distanceKm",        extKey: "distance_km" },
      { key: "avgPowerWatts",     extKey: "avg_power_watts" },
      { key: "avgHeartRate",      extKey: "avg_heart_rate" },
      { key: "elevationM",        extKey: "elevation_m" },
      { key: "estimatedCalories", extKey: "estimated_calories" },
    ];

    for (const { key, extKey } of fieldMap) {
      const original = extraction.fields[extKey].value;
      const edited = fields[key] !== "" ? parseFloat(fields[key]) : null;
      if (edited !== null && edited !== original) {
        corrections[key] = { original, corrected: edited };
      }
    }

    return corrections;
  }

  // ── auto: save ────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError(null);

    const corrections = buildCorrections();
    const hasCorrections = Object.keys(corrections).length > 0;

    const body = {
      source: extraction?.source_detected ?? "unknown",
      activityDate,
      calendarEventId: selectedEventId,
      durationMinutes:   fields.durationMinutes   !== "" ? parseInt(fields.durationMinutes, 10)    : null,
      distanceKm:        fields.distanceKm         !== "" ? parseFloat(fields.distanceKm)          : null,
      avgPowerWatts:     fields.avgPowerWatts       !== "" ? parseInt(fields.avgPowerWatts, 10)     : null,
      avgHeartRate:      fields.avgHeartRate        !== "" ? parseInt(fields.avgHeartRate, 10)      : null,
      elevationM:        fields.elevationM          !== "" ? parseInt(fields.elevationM, 10)        : null,
      estimatedCalories: fields.estimatedCalories  !== "" ? parseInt(fields.estimatedCalories, 10) : null,
      extractionConfidence: extraction?.overall_confidence ?? null,
      extractedData: extraction ?? null,
      corrections: hasCorrections ? corrections : null,
    };

    const res = await fetch("/api/training-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      setSaving(false);
      return;
    }

    setStage("saved");
    setSaving(false);
  }

  // ── auto: reset ───────────────────────────────────────────────────────────

  function reset() {
    setStage("pick");
    setPreviewUrl(null);
    setImageBase64(null);
    setExtraction(null);
    setSelectedEventId(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── manual: save ──────────────────────────────────────────────────────────

  async function handleManualSave() {
    setManualSaving(true);
    setManualError(null);

    const body = {
      source: "manual",
      activityDate: manualFields.date,
      calendarEventId: null,
      durationMinutes:   manualFields.durationMinutes   !== "" ? parseInt(manualFields.durationMinutes, 10)    : null,
      distanceKm:        manualFields.distanceKm         !== "" ? parseFloat(manualFields.distanceKm)          : null,
      avgPowerWatts:     manualFields.avgPowerWatts       !== "" ? parseInt(manualFields.avgPowerWatts, 10)     : null,
      avgHeartRate:      manualFields.avgHeartRate        !== "" ? parseInt(manualFields.avgHeartRate, 10)      : null,
      elevationM:        manualFields.elevationM          !== "" ? parseInt(manualFields.elevationM, 10)        : null,
      estimatedCalories: manualFields.estimatedCalories  !== "" ? parseInt(manualFields.estimatedCalories, 10) : null,
      notes: manualFields.notes || null,
      extractionConfidence: null,
      extractedData: null,
      corrections: null,
    };

    const res = await fetch("/api/training-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setManualError(data.error ?? "Failed to save.");
      setManualSaving(false);
      return;
    }

    setManualSaved(true);
    setManualSaving(false);
  }

  function handleManualFieldChange(key: keyof ManualFields, val: string) {
    setManualFields((prev) => ({ ...prev, [key]: val }));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (stage === "saved" || manualSaved) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-lime-400/10 flex items-center justify-center">
          <span className="text-lime-400 text-2xl">✓</span>
        </div>
        <div>
          <p className="text-white font-semibold text-lg">Saved</p>
          <p className="text-zinc-500 text-sm mt-1">Training data added to your log.</p>
        </div>
        <button
          onClick={() => { reset(); setManualSaved(false); }}
          className="mt-4 text-sm text-zinc-500 underline hover:text-zinc-300 transition-colors"
        >
          Log another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-6 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("auto")}
          className={`pb-3 text-sm font-medium transition-colors ${
            tab === "auto"
              ? "text-lime-400 border-b-2 border-lime-400 -mb-px"
              : "text-zinc-500"
          }`}
        >
          Auto
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`pb-3 text-sm font-medium transition-colors ${
            tab === "manual"
              ? "text-lime-400 border-b-2 border-lime-400 -mb-px"
              : "text-zinc-500"
          }`}
        >
          Manual
        </button>
      </div>

      {/* ── Auto tab ── */}
      {tab === "auto" && (
        <div className="space-y-5">
          {/* Image picker */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">Screenshot</p>
            <label
              className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                previewUrl
                  ? "border-zinc-700 p-1"
                  : "border-zinc-800 hover:border-zinc-600 py-10 bg-zinc-900"
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="w-full rounded-lg object-contain max-h-72"
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="text-3xl text-zinc-700">↑</div>
                  <p className="text-zinc-500 text-sm">Tap to choose screenshot</p>
                  <p className="text-zinc-700 text-xs">JPG, PNG or WebP</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleFileChange}
                disabled={stage === "extracting"}
              />
            </label>
            {previewUrl && stage === "pick" && (
              <button
                onClick={() => { setPreviewUrl(null); setImageBase64(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-xs text-zinc-600 mt-1 hover:text-zinc-400 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Analyse button */}
          {stage === "pick" && (
            <button
              onClick={runExtraction}
              disabled={!imageBase64}
              className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-lime-300 transition-colors"
            >
              Analyse with AI
            </button>
          )}

          {/* Extracting state */}
          {stage === "extracting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm">Analysing screenshot…</p>
            </div>
          )}

          {/* Review stage */}
          {(stage === "review" || stage === "linking") && extraction && (
            <div className="space-y-5">
              {/* Confidence banner */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${confidenceBg(extraction.overall_confidence)}`}
              >
                <div>
                  <p className={`text-sm font-semibold ${confidenceColour(extraction.overall_confidence)}`}>
                    {confidenceLabel(extraction.overall_confidence)}
                  </p>
                  {extraction.notes && (
                    <p className="text-zinc-600 text-xs mt-0.5">{extraction.notes}</p>
                  )}
                </div>
                <span className={`text-lg font-bold tabular-nums ${confidenceColour(extraction.overall_confidence)}`}>
                  {extraction.overall_confidence}%
                </span>
              </div>

              {/* Extracted fields */}
              <div>
                <p className="text-xs text-zinc-500 mb-1">Tap any value to edit</p>
                <div className="bg-zinc-900 rounded-xl px-4">
                  <FieldRow label="Duration"       fieldKey="durationMinutes"   unit="min"  value={fields.durationMinutes}   confidence={extraction.fields.duration_minutes.confidence}   onChange={handleFieldChange} />
                  <FieldRow label="Distance"        fieldKey="distanceKm"        unit="km"   value={fields.distanceKm}        confidence={extraction.fields.distance_km.confidence}        onChange={handleFieldChange} />
                  <FieldRow label="Avg power"       fieldKey="avgPowerWatts"     unit="W"    value={fields.avgPowerWatts}     confidence={extraction.fields.avg_power_watts.confidence}    onChange={handleFieldChange} />
                  <FieldRow label="Avg heart rate"  fieldKey="avgHeartRate"      unit="bpm"  value={fields.avgHeartRate}      confidence={extraction.fields.avg_heart_rate.confidence}     onChange={handleFieldChange} />
                  <FieldRow label="Elevation"       fieldKey="elevationM"        unit="m"    value={fields.elevationM}        confidence={extraction.fields.elevation_m.confidence}        onChange={handleFieldChange} />
                  <FieldRow label="Calories"        fieldKey="estimatedCalories" unit="kcal" value={fields.estimatedCalories} confidence={extraction.fields.estimated_calories.confidence} onChange={handleFieldChange} />
                </div>
              </div>

              {/* Activity date */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">Activity date</p>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full bg-zinc-900 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 [color-scheme:dark]"
                />
              </div>

              {/* Link to calendar event */}
              {stage === "linking" && calendarEvents !== null && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Link to calendar session (optional)</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    <button
                      onClick={() => setSelectedEventId(null)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                        selectedEventId === null
                          ? "bg-lime-400/10 text-lime-400 ring-1 ring-lime-400/40"
                          : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800"
                      }`}
                    >
                      No link
                    </button>
                    {calendarEvents.length === 0 && (
                      <p className="text-zinc-700 text-xs px-1">No sessions found in the last 14 days.</p>
                    )}
                    {calendarEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                          selectedEventId === ev.id
                            ? "bg-lime-400/10 text-lime-400 ring-1 ring-lime-400/40"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        <span className="font-medium">{ev.title}</span>
                        <span className="text-zinc-600 text-xs ml-2">{fmtDate(ev.scheduledAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                {stage === "review" && (
                  <button
                    onClick={loadCalendarEvents}
                    disabled={loadingEvents}
                    className="w-full py-3 bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-sm hover:bg-zinc-700 transition-colors"
                  >
                    {loadingEvents ? "Loading sessions…" : "Link to a session →"}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
                >
                  {saving ? "Saving…" : "Confirm & save"}
                </button>
                <button
                  onClick={reset}
                  className="text-zinc-700 text-sm hover:text-zinc-500 transition-colors py-1"
                >
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual tab ── */}
      {tab === "manual" && (
        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Activity date</label>
            <input
              type="date"
              value={manualFields.date}
              onChange={(e) => handleManualFieldChange("date", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400 [color-scheme:dark]"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Duration (minutes)</label>
            <input
              type="number"
              value={manualFields.durationMinutes}
              onChange={(e) => handleManualFieldChange("durationMinutes", e.target.value)}
              placeholder="e.g. 90"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Distance (km)</label>
            <input
              type="number"
              step="0.1"
              value={manualFields.distanceKm}
              onChange={(e) => handleManualFieldChange("distanceKm", e.target.value)}
              placeholder="e.g. 45.2"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Avg power */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Avg power (watts) <span className="text-zinc-600">optional</span></label>
            <input
              type="number"
              value={manualFields.avgPowerWatts}
              onChange={(e) => handleManualFieldChange("avgPowerWatts", e.target.value)}
              placeholder="e.g. 195"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Avg HR */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Avg heart rate (bpm) <span className="text-zinc-600">optional</span></label>
            <input
              type="number"
              value={manualFields.avgHeartRate}
              onChange={(e) => handleManualFieldChange("avgHeartRate", e.target.value)}
              placeholder="e.g. 148"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Elevation */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Elevation (metres) <span className="text-zinc-600">optional</span></label>
            <input
              type="number"
              value={manualFields.elevationM}
              onChange={(e) => handleManualFieldChange("elevationM", e.target.value)}
              placeholder="e.g. 620"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Calories */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Estimated calories <span className="text-zinc-600">optional</span></label>
            <input
              type="number"
              value={manualFields.estimatedCalories}
              onChange={(e) => handleManualFieldChange("estimatedCalories", e.target.value)}
              placeholder="e.g. 1200"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-zinc-400 text-sm mb-1.5">Notes <span className="text-zinc-600">optional</span></label>
            <textarea
              value={manualFields.notes}
              onChange={(e) => handleManualFieldChange("notes", e.target.value)}
              placeholder="e.g. Felt strong, legs good"
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-400 resize-none"
            />
          </div>

          {manualError && <p className="text-red-400 text-sm">{manualError}</p>}

          <button
            onClick={handleManualSave}
            disabled={manualSaving}
            className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
          >
            {manualSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
