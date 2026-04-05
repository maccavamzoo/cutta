"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import type { UnitSystem } from "@/lib/units";
import DayDetailSheet from "./DayDetailSheet";

interface DaySummary {
  events:       { id: number; title: string; eventType: string; durationMinutes: number | null }[];
  hasPlan:      boolean;
  planCalories: number | null;
  compliance:   "yes" | "mostly" | "no" | null;
  hasWeighIn:   boolean;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthHeading(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" })
    .format(new Date(y, m - 1, 1));
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  dateStr,
  dayNum,
  isToday,
  summary,
  onSelect,
}: {
  dateStr:  string | null;
  dayNum:   number | null;
  isToday:  boolean;
  summary:  DaySummary | null;
  onSelect: () => void;
}) {
  if (!dateStr) return <div className="min-h-[52px] bg-zinc-900/30" />;

  return (
    <button
      onClick={onSelect}
      className={`min-h-[52px] bg-zinc-900 flex flex-col items-center justify-start pt-1.5 pb-1 transition-colors hover:bg-zinc-800 ${
        isToday ? "ring-1 ring-inset ring-lime-400" : ""
      }`}
    >
      <span className={`text-xs font-medium ${isToday ? "text-lime-400" : "text-zinc-300"}`}>
        {dayNum}
      </span>
      {summary && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {summary.hasPlan && <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />}
          {summary.events.length > 0 && (
            <span className={`w-1.5 h-1.5 rounded-full ${
              summary.events.some((e) => e.eventType.toLowerCase().includes("race"))
                ? "bg-orange-400"
                : "bg-sky-400"
            }`} />
          )}
          {summary.compliance && (
            <span className={`w-1.5 h-1.5 rounded-full ${
              summary.compliance === "yes"    ? "bg-emerald-400" :
              summary.compliance === "mostly" ? "bg-amber-400"   : "bg-zinc-500"
            }`} />
          )}
          {summary.hasWeighIn && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
        </div>
      )}
    </button>
  );
}

// ── CalendarView ──────────────────────────────────────────────────────────────

export default function CalendarView({
  initialMonth,
  timezone,
  unitSystem,
  activityTypes,
}: {
  initialMonth:  string;
  timezone:      string;
  unitSystem:    UnitSystem;
  activityTypes: ActivityTypeOption[];
}) {
  const router = useRouter();

  const [currentMonth,  setCurrentMonth]  = useState(initialMonth);
  const [monthData,     setMonthData]     = useState<Record<string, DaySummary> | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setMonthData(null);
    fetch(`/api/calendar/monthly?month=${currentMonth}`)
      .then((r) => r.json())
      .then((data: { days: Record<string, DaySummary> }) => {
        setMonthData(data.days);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentMonth]);

  function goToPrevMonth() { setCurrentMonth((m) => shiftMonth(m, -1)); }
  function goToNextMonth() {
    const next = shiftMonth(currentMonth, 1);
    const maxMonth = shiftMonth(initialMonth, 12);
    if (next <= maxMonth) setCurrentMonth(next);
  }

  // Build grid cells
  const [year, month] = currentMonth.split("-").map(Number);
  const firstDow     = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startPad     = firstDow === 0 ? 6 : firstDow - 1;     // Monday-start offset
  const daysInMonth  = new Date(year, month, 0).getDate();

  type Cell = { dateStr: string; dayNum: number } | null;
  const cells: Cell[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${currentMonth}-${String(d).padStart(2, "0")}`,
      dayNum:  d,
    });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  return (
    <div>
      {/* Back link */}
      <div className="mb-3">
        <button
          onClick={() => router.push("/plan")}
          className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
        >
          ← Plan
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={goToPrevMonth}
          className="text-zinc-500 hover:text-white p-2 transition-colors"
          aria-label="Previous month"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-white">{formatMonthHeading(currentMonth)}</h1>
        <div className="flex items-center gap-2">
          {currentMonth !== initialMonth && (
            <button
              onClick={() => setCurrentMonth(initialMonth)}
              className="text-xs text-lime-400 px-2 py-1 rounded-full border border-lime-400/30"
            >
              Today
            </button>
          )}
          <button
            onClick={goToNextMonth}
            className="text-zinc-500 hover:text-white p-2 transition-colors"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-zinc-600 text-xs font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-px bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-800">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[52px] bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-800">
          {cells.map((cell, i) => (
            <DayCell
              key={i}
              dateStr={cell?.dateStr ?? null}
              dayNum={cell?.dayNum ?? null}
              isToday={cell?.dateStr === todayStr}
              summary={cell ? (monthData?.[cell.dateStr] ?? null) : null}
              onSelect={() => { if (cell) setSelectedDate(cell.dateStr); }}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-3">
        <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400" /> Plan
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Activity
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Check-in
        </span>
        <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Weigh-in
        </span>
      </div>

      {/* Day detail sheet */}
      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          timezone={timezone}
          unitSystem={unitSystem}
          activityTypes={activityTypes}
          onClose={() => setSelectedDate(null)}
          onDataChanged={() => {
            // Re-fetch month data so dots update
            fetch(`/api/calendar/monthly?month=${currentMonth}`)
              .then((r) => r.json())
              .then((data: { days: Record<string, DaySummary> }) => setMonthData(data.days))
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
