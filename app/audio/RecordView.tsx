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

function NoteItem({ note }: { note: AudioNote }) {
  const [open, setOpen] = useState(false);
  const data = note.processedData as ProcessedData | null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-start justify-between px-4 py-3 text-left gap-3"
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
        <span className="text-zinc-700 text-xs shrink-0 pt-0.5">{open ? "▲" : "▼"}</span>
      </button>

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

// ─── main component ───────────────────────────────────────────────────────────

export default function RecordView({ initialNotes }: { initialNotes: AudioNote[] }) {
  const [stage,      setStage]      = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsed,    setElapsed]    = useState(0);
  const [result,     setResult]     = useState<{ transcript: string; processedData: ProcessedData | null } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [notes,      setNotes]      = useState<AudioNote[]>(initialNotes);
  const [hasSpeech,  setHasSpeech]  = useState(false);

  const recognitionRef  = useRef<AnySpeechRecognition | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef    = useRef("");
  const isRecordingRef  = useRef(false); // ref-based flag — never stale in callbacks

  // Check speech API availability
  useEffect(() => {
    setHasSpeech(!!getSpeechRecognition());
  }, []);

  // Cleanup on unmount
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
    rec.interimResults = false; // final results only — eliminates all echo/doubling
    rec.lang           = "en-GB";

    rec.onresult = (event: {
      results: { isFinal: boolean; [index: number]: { transcript: string } }[];
      resultIndex: number;
    }) => {
      // With interimResults=false every result is already final
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
      // Restart on silence timeout only — use a ref so the check is never stale
      if (isRecordingRef.current) {
        try { rec.start(); } catch { /* already stopped by handleStop */ }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [startTimer, stopTimer, stage]);

  const handleStop = useCallback(async () => {
    stopTimer();

    if (recognitionRef.current) {
      isRecordingRef.current = false;       // must be set before .stop() fires onend
      recognitionRef.current.onend = null;  // belt-and-suspenders
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
      const res  = await fetch("/api/audio-notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transcript: finalTranscript, durationSeconds: elapsed }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setResult({ transcript: finalTranscript, processedData: data.processedData });
      setStage("done");

      // Prepend new note to history list
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

  return (
    <div className="space-y-6">
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
              {/* Mic icon */}
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
              {/* Stop icon */}
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

        {/* Browser capability warning */}
        {!hasSpeech && stage === "idle" && (
          <p className="text-center text-amber-500 text-xs mt-2">
            Use Chrome or Safari for voice recording.
          </p>
        )}

        {/* Live transcript */}
        {stage === "recording" && transcript && (
          <div className="mt-4 bg-black/40 rounded-xl px-3 py-3 max-h-32 overflow-y-auto">
            <p className="text-zinc-300 text-sm leading-relaxed">{transcript}</p>
          </div>
        )}
      </div>

      {/* Result */}
      {stage === "done" && result && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Just recorded</p>
          </div>
          {result.processedData ? (
            <ProcessedCard data={result.processedData} />
          ) : (
            <p className="text-zinc-400 text-sm">{result.transcript}</p>
          )}
        </div>
      )}

      {/* History */}
      {notes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Previous notes
          </p>
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
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
