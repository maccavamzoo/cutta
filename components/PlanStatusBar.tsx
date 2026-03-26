"use client";

import { useEffect, useState } from "react";

export default function PlanStatusBar() {
  const [stale,      setStale]      = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done,       setDone]       = useState(false);

  useEffect(() => {
    fetch("/api/fuelling-plan/status")
      .then((r) => r.json())
      .then((d) => { if (d.stale === true) setStale(true); })
      .catch(() => {});
  }, []);

  if (!stale) return null;

  async function handleRegenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      await fetch("/api/fuelling-plan/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ startDate: todayStr }),
      });
      setDone(true);
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed bottom-[52px] left-0 right-0 z-30 flex justify-center pointer-events-none">
      <div className="w-full max-w-lg pointer-events-auto">
        <div className="mx-4 mb-1.5 bg-amber-950 border border-amber-700/60 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <div className="flex-1 min-w-0">
            {generating ? (
              <p className="text-amber-300 text-xs font-medium">
                {done ? "Done — reloading…" : "Regenerating plan…"}
              </p>
            ) : (
              <p className="text-amber-300 text-xs leading-snug">
                Plan update available —{" "}
                <span className="text-amber-400/70">regenerate when you&apos;re done making changes</span>
              </p>
            )}
          </div>
          {generating ? (
            <div className="shrink-0 w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <button
              onClick={handleRegenerate}
              className="shrink-0 px-3 py-1.5 bg-amber-400 text-black text-xs font-bold rounded-lg hover:bg-amber-300 active:bg-amber-500 transition-colors whitespace-nowrap"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
