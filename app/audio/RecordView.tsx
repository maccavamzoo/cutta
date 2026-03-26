"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

interface ProcessedData {
  summary:         string;
  tags:            string[];
  energy_level:    "low" | "moderate" | "high" | null;
  gut_comfort:     number | null;
  symptoms:        string[];
  foods_mentioned: string[];
  sentiment:       "positive" | "neutral" | "negative";
  action_items:    string[];
  plan_impact:     string | null;
}

interface AudioNote {
  id:               number;
  transcript:       string | null;
  processedData:    ProcessedData | null;
  processingStatus: string;
  recordedAt:       string;
}

type Stage = "idle" | "recording" | "processing" | "done" | "error";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const SENTIMENT_COLOUR: Record<string, string> = {
  positive: "text-lime-400",
  neutral:  "text-zinc-400",
  negative: "text-red-400",
};

const ENERGY_LABEL: Record<string, string> = {
  low:      "Low energy",
  moderate: "Moderate energy",
  high:     "High energy",
};

// ─── SpeechRecognition setup ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

function getSpeechRecognition(): (new () => AnySpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

// ─── processed result card ───────────────────────────────────────────────────

function ProcessedCard({ data }: { data: ProcessedData }) {
  const isImpact = data.plan_impact && !data.plan_impact.toLowerCase().startsWith("no plan impact");

  return (
    <div className="space-y-3">
      {data.summary && (
        <p className="text-zinc-300 text-sm leading-relaxed">{data.summary}</p>
      )}

      {/* Plan impact */}
      {data.plan_impact && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${
          isImpact
            ? "bg-lime-400/5 border-lime-400/20"
            : "bg-zinc-800/50 border-zinc-700"
        }`}>
          <span className={`text-xs mt-0.5 shrink-0 ${isImpact ? "text-lime-400" : "text-zinc-600"}`}>
            {isImpact ? "→" : "·"}
          </span>
          <p className={`text-xs leading-relaxed ${isImpact ? "text-lime-300" : "text-zinc-500"}`}>
            {data.plan_impact}
          </p>
        </div>
      )}

      {/* Tags */}
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Metrics row */}
      {(data.energy_level || data.gut_comfort != null) && (
        <div className="flex gap-3">
          {data.energy_level && (
            <div className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 text-center">
              <p className="text-white text-xs font-semibold">{ENERGY_LABEL[data.energy_level]}</p>
              <p className="text-zinc-600 text-xs mt-0.5">Energy</p>
            </div>
          )}
          {data.gut_comfort != null && (
            <div className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 text-center">
              <p className="text-white text-xs font-semibold">{data.gut_comfort}/5</p>
              <p className="text-zinc-600 text-xs mt-0.5">Gut comfort</p>
            </div>
          )}
        </div>
      )}

      {/* Symptoms */}
      {data.symptoms.length > 0 && (
        <div>
          <p className="text-zinc-600 text-xs uppercase tracking-wider font-semibold mb-1">Symptoms</p>
          <p className="text-zinc-400 text-sm">{data.symptoms.join(", ")}</p>
        </div>
      )}

      {/* Foods */}
      {data.foods_mentioned.length > 0 && (
        <div>
          <p className="text-zinc-600 text-xs uppercase tracking-wider font-semibold mb-1">Foods</p>
          <p className="text-zinc-400 text-sm">{data.foods_mentioned.join(", ")}</p>
        </div>
      )}

      {/* Action items */}
      {data.action_items.length > 0 && (
        <div>
          <p className="text-zinc-600 text-xs uppercase tracking-wider font-semibold mb-1.5">Actions</p>
          <ul className="space-y-1">
            {data.action_items.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="text-lime-400 shrink-0">→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── note history item ────────────────────────────────────────────────────────

function NoteItem({
  note,
  onDelete,
}: {
  note:     AudioNote;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open,             setOpen]             = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const data = note.processedData as ProcessedData | null;

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Summary / transcript — tappable to expand */}
        <button
          onClick={() => setOpen((x) => !x)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex-1 min-w-0">
            {data?.summary ? (
              <p className="text-zinc-300 text-sm line-clamp-2">{data.summary}</p>
            ) : (
              <p className="text-zinc-500 text-sm italic line-clamp-2">
                {note.transcript ?? "No transcript"}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-zinc-600 text-xs">{fmtRelative(note.recordedAt)}</span>
              {data?.sentiment && (
                <span className={`text-xs ${SENTIMENT_COLOUR[data.sentiment] ?? "text-zinc-500"}`}>
                  ● {data.sentiment}
                </span>
              )}
              {data?.tags.slice(0, 2).map((t) => (
                <span key={t} className="text-xs text-zinc-600">{t}</span>
              ))}
            </div>
            {data?.plan_impact && (
              <p className={`text-xs mt-1 leading-snug ${
                !data.plan_impact.toLowerCase().startsWith("no plan impact")
                  ? "text-lime-600"
                  : "text-zinc-600"
              }`}>
                {data.plan_impact}
              </p>
            )}
          </div>
        </button>

        {/* Right side: delete control + chevron */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-400 text-xs font-semibold hover:text-red-300 transition-colors disabled:opacity-40"
              >
                {deleting ? "…" : "Delete"}
              </button>
              <span className="text-zinc-700 text-xs">·</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-zinc-700 hover:text-zinc-500 transition-colors p-0.5"
              aria-label="Delete note"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10.5 3.5l-.6 7a.5.5 0 0 1-.5.5H3.6a.5.5 0 0 1-.5-.5l-.6-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button onClick={() => setOpen((x) => !x)}>
            <span className="text-zinc-700 text-xs">{open ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {open && data && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
          <ProcessedCard data={data} />
        </div>
      )}

      {open && !data && note.transcript && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
          <p className="text-zinc-400 text-sm">{note.transcript}</p>
        </div>
      )}
    </div>
  );
}

// ─── how notes work explainer ─────────────────────────────────────────────────

function HowNotesWork() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-zinc-500 shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 6.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="4.25" r="0.8" fill="currentColor" />
          </svg>
          <span className="text-zinc-500 text-xs font-medium">How voice notes work</span>
        </div>
        <span className="text-zinc-700 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
          <p className="text-zinc-400 text-xs leading-relaxed">
            Your voice notes are processed by AI and used to update your profile over time.
            Insights about food reactions, energy patterns, and gut triggers are automatically
            learned and applied to future plans.
          </p>
          <ul className="space-y-1.5">
            {[
              "Mention a food that upset your stomach → it gets added to your gut trigger list",
              "Report a great ride after eating rice cakes → positive food association logged",
              "Note low energy after a rest day → pre-ride fuelling timing reviewed",
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-500">
                <span className="text-lime-600 shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-zinc-600 text-xs">
            These insights are used when generating your fuelling plan — no raw notes are sent, only the learned profile.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function RecordView({
  initialNotes,
  totalNoteCount = 0,
}: {
  initialNotes:    AudioNote[];
  totalNoteCount?: number;
}) {
  const [stage,      setStage]      = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsed,    setElapsed]    = useState(0);
  const [result,     setResult]     = useState<{
    transcript:     string;
    processedData:  ProcessedData | null;
    profileChanges: string | null;
  } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [notes,      setNotes]      = useState<AudioNote[]>(initialNotes);
  const [hasSpeech,  setHasSpeech]  = useState(false);

  const recognitionRef  = useRef<AnySpeechRecognition | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef    = useRef("");
  const isRecordingRef  = useRef(false);

  useEffect(() => {
    setHasSpeech(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current)       clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      setError("Speech recognition is not supported in your browser. Try Chrome or Safari.");
      return;
    }

    setStage("recording");
    setTranscript("");
    setError(null);
    setResult(null);
    finalTextRef.current = "";
    isRecordingRef.current = true;
    startTimer();

    const rec = new SpeechRec();
    rec.continuous     = true;
    rec.interimResults = false;
    rec.lang           = "en-GB";

    rec.onresult = (event: {
      results: { isFinal: boolean; [index: number]: { transcript: string } }[];
      resultIndex: number;
    }) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        finalTextRef.current += event.results[i][0].transcript + " ";
      }
      setTranscript(finalTextRef.current.trim());
    };

    rec.onerror = (e: { error: string }) => {
      console.error("[speech]", e.error);
      if (e.error === "not-allowed") {
        setError("Microphone access denied. Allow microphone in your browser settings.");
        isRecordingRef.current = false;
        setStage("idle");
        stopTimer();
      }
    };

    rec.onend = () => {
      if (isRecordingRef.current) {
        try { rec.start(); } catch { /* stopped by handleStop */ }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [startTimer, stopTimer, stage]);

  const handleStop = useCallback(async () => {
    stopTimer();

    if (recognitionRef.current) {
      isRecordingRef.current = false;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const finalTranscript = finalTextRef.current.trim() || transcript.trim();

    if (!finalTranscript) {
      setStage("idle");
      setError("No speech detected. Try again.");
      return;
    }

    setStage("processing");

    try {
      const res = await fetch("/api/audio-notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transcript: finalTranscript, durationSeconds: elapsed }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setResult({
        transcript:     finalTranscript,
        processedData:  data.processedData,
        profileChanges: data.profileChanges ?? null,
      });
      setStage("done");

      if (data.id) {
        setNotes((prev) => [
          {
            id:               data.id,
            transcript:       finalTranscript,
            processedData:    data.processedData,
            processingStatus: "done",
            recordedAt:       new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to process note. Try again.");
      setStage("error");
    }
  }, [stopTimer, transcript, elapsed]);

  const handleReset = useCallback(() => {
    setStage("idle");
    setTranscript("");
    setElapsed(0);
    setResult(null);
    setError(null);
    finalTextRef.current = "";
  }, []);

  const handleDeleteNote = useCallback(async (id: number) => {
    await fetch(`/api/audio-notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <div className="space-y-6">
      {/* How notes work explainer */}
      <HowNotesWork />

      {/* Record card */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-6">
        {/* Status header */}
        <div className="text-center mb-6 space-y-1 min-h-[3rem]">
          {stage === "idle"       && <p className="text-zinc-500 text-sm">Tap to start recording</p>}
          {stage === "recording"  && (
            <>
              <p className="text-lime-400 text-sm font-semibold animate-pulse">Recording…</p>
              <p className="text-white text-2xl font-mono tabular-nums">{fmtTime(elapsed)}</p>
            </>
          )}
          {stage === "processing" && <p className="text-zinc-400 text-sm animate-pulse">Processing with AI…</p>}
          {stage === "done"       && <p className="text-lime-400 text-sm font-semibold">Note saved</p>}
          {stage === "error"      && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Big record button */}
        <div className="flex justify-center mb-6">
          {(stage === "idle" || stage === "error") && (
            <button
              onClick={handleStart}
              disabled={!hasSpeech && stage !== "error"}
              className="w-24 h-24 rounded-full bg-lime-400 text-black flex items-center justify-center shadow-lg shadow-lime-400/20 active:scale-95 transition-transform disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.07A8.001 8.001 0 0 0 20 12a1 1 0 0 0-2 0 6 6 0 0 1-12 0 1 1 0 0 0-2 0 8.001 8.001 0 0 0 7 7.93z"/>
              </svg>
            </button>
          )}

          {stage === "recording" && (
            <button
              onClick={handleStop}
              className="w-24 h-24 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <rect x="5" y="5" width="14" height="14" rx="2"/>
              </svg>
            </button>
          )}

          {stage === "processing" && (
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {stage === "done" && (
            <button
              onClick={handleReset}
              className="w-24 h-24 rounded-full bg-zinc-800 text-lime-400 border border-lime-400/30 flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.07A8.001 8.001 0 0 0 20 12a1 1 0 0 0-2 0 6 6 0 0 1-12 0 1 1 0 0 0-2 0 8.001 8.001 0 0 0 7 7.93z"/>
              </svg>
            </button>
          )}
        </div>

        {stage === "done" && (
          <p className="text-center text-zinc-600 text-xs">Tap mic to record another</p>
        )}

        {!hasSpeech && stage === "idle" && (
          <p className="text-center text-amber-500 text-xs mt-2">
            Use Chrome or Safari for voice recording.
          </p>
        )}

        {stage === "recording" && transcript && (
          <div className="mt-4 bg-black/40 rounded-xl px-3 py-3 max-h-32 overflow-y-auto">
            <p className="text-zinc-300 text-sm leading-relaxed">{transcript}</p>
          </div>
        )}
      </div>

      {/* Result */}
      {stage === "done" && result && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-4 space-y-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Just recorded</p>

          {result.processedData ? (
            <ProcessedCard data={result.processedData} />
          ) : (
            <p className="text-zinc-400 text-sm">{result.transcript}</p>
          )}

          {/* Profile update callout */}
          {result.profileChanges && (
            <div className="flex items-start gap-2 bg-sky-400/5 border border-sky-400/20 rounded-xl px-3 py-2.5">
              <span className="text-sky-400 text-xs shrink-0 mt-0.5">↑</span>
              <p className="text-sky-300 text-xs leading-relaxed">
                <span className="font-semibold">Updated your profile:</span>{" "}
                {result.profileChanges}
              </p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {notes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Previous notes
            </p>
            {totalNoteCount > notes.length && (
              <span className="text-zinc-700 text-xs">showing last {notes.length} of {totalNoteCount}</span>
            )}
          </div>
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} onDelete={handleDeleteNote} />
          ))}
        </div>
      )}

      {notes.length === 0 && stage === "idle" && (
        <p className="text-center text-zinc-700 text-sm py-4">
          No notes yet — start recording.
        </p>
      )}
    </div>
  );
}
