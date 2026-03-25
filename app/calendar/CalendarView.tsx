"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import AddEventSheet from "./AddEventSheet";
import type { CalendarEvent } from "./AddEventSheet";

export type { CalendarEvent };

// ─── helpers ────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeDay(a: Date, b: Date): boolean {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return da < db;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.toLocaleDateString("en-GB", opts)}`;
  }
  return `${monday.toLocaleDateString("en-GB", opts)} – ${sunday.toLocaleDateString("en-GB", opts)}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── style maps ─────────────────────────────────────────────────────────────

const TYPE_BORDER: Record<string, string> = {
  ride:  "border-lime-400",
  race:  "border-orange-400",
  rest:  "border-zinc-600",
  other: "border-blue-400",
};

const TYPE_BG: Record<string, string> = {
  ride:  "bg-lime-400/10",
  race:  "bg-orange-400/10",
  rest:  "bg-zinc-800",
  other: "bg-blue-400/10",
};

const TYPE_DOT: Record<string, string> = {
  ride:  "bg-lime-400",
  race:  "bg-orange-400",
  rest:  "bg-zinc-500",
  other: "bg-blue-400",
};

const INTENSITY_LABEL: Record<string, string> = {
  easy:     "Easy",
  moderate: "Moderate",
  hard:     "Hard",
  race:     "Race pace",
};

// ─── sub-components ─────────────────────────────────────────────────────────

function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 ${TYPE_BORDER[event.eventType] ?? "border-zinc-600"} ${TYPE_BG[event.eventType] ?? "bg-zinc-800"}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{event.title}</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          {fmtTime(event.scheduledAt)}
          {event.durationMinutes ? ` · ${fmtDuration(event.durationMinutes)}` : ""}
          {event.intensity ? ` · ${INTENSITY_LABEL[event.intensity] ?? event.intensity}` : ""}
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-l-2 space-y-1 ${TYPE_BORDER[event.eventType] ?? "border-zinc-600"} ${TYPE_BG[event.eventType] ?? "bg-zinc-800"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-white font-semibold">{event.title}</p>
        <span className="text-zinc-500 text-xs shrink-0 pt-0.5">
          {fmtTime(event.scheduledAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {event.durationMinutes ? (
          <span className="text-zinc-400 text-xs">
            {fmtDuration(event.durationMinutes)}
          </span>
        ) : null}
        {event.intensity ? (
          <span className="text-zinc-400 text-xs">
            {INTENSITY_LABEL[event.intensity] ?? event.intensity}
          </span>
        ) : null}
        <span className="text-zinc-600 text-xs capitalize">{event.eventType}</span>
      </div>
      {event.notes ? (
        <p className="text-zinc-500 text-xs pt-0.5">{event.notes}</p>
      ) : null}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function CalendarView({
  initialEvents,
}: {
  initialEvents: CalendarEvent[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addDate, setAddDate] = useState<Date>(today);

  const weekDays = getWeekDays(monday);

  const fetchWeek = useCallback(async (weekMonday: Date) => {
    setLoading(true);
    const from = weekMonday.toISOString();
    const to = new Date(
      weekMonday.getTime() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events);
    }
    setLoading(false);
  }, []);

  function navigate(dir: -1 | 1) {
    const next = new Date(monday);
    next.setDate(next.getDate() + dir * 7);
    setMonday(next);
    setSelectedDay(null);
    fetchWeek(next);
  }

  function jumpToToday() {
    const thisMonday = getMondayOfWeek(new Date());
    setMonday(thisMonday);
    setSelectedDay(today);
    fetchWeek(thisMonday);
  }

  function eventsForDay(day: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(new Date(e.scheduledAt), day));
  }

  function openAdd(day: Date) {
    setAddDate(day);
    setAddSheetOpen(true);
  }

  function handleAdded(event: CalendarEvent) {
    setEvents((prev) =>
      [...prev, event].sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
    );
    setAddSheetOpen(false);
  }

  // ── Day view ───────────────────────────────────────────────────────────────
  if (selectedDay) {
    const dayEvents = eventsForDay(selectedDay);
    const isToday = isSameDay(selectedDay, today);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedDay(null)}
            className="flex items-center gap-1 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
          >
            ← Week
          </button>
          <button
            onClick={() => openAdd(selectedDay)}
            className="bg-lime-400 text-black text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-lime-300 transition-colors"
          >
            + Add
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">
            {selectedDay.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          {isToday && (
            <span className="text-xs text-lime-400 font-medium">Today</span>
          )}
        </div>

        {dayEvents.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <p className="text-zinc-500 text-sm">No sessions planned.</p>
            <button
              onClick={() => openAdd(selectedDay)}
              className="text-zinc-600 text-xs underline"
            >
              Add a training session
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}

        {/* Log training link */}
        <div className="pt-2 border-t border-zinc-900">
          <Link
            href="/training/upload"
            className="flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <div>
              <p className="text-white text-sm font-medium">Log training</p>
              <p className="text-zinc-600 text-xs mt-0.5">
                Upload a Strava or Rouvy screenshot
              </p>
            </div>
            <span className="text-zinc-600 text-lg">→</span>
          </Link>
        </div>

        {addSheetOpen && (
          <AddEventSheet
            defaultDate={addDate}
            onClose={() => setAddSheetOpen(false)}
            onAdded={handleAdded}
          />
        )}
      </div>
    );
  }

  // ── Week view ──────────────────────────────────────────────────────────────
  const isCurrentWeek = isSameDay(monday, getMondayOfWeek(new Date()));
  const hasAnyEvents = weekDays.some((d) => eventsForDay(d).length > 0);

  return (
    <div className="space-y-5">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors text-xl"
          aria-label="Previous week"
        >
          ‹
        </button>

        <button
          onClick={jumpToToday}
          className="flex flex-col items-center"
        >
          <span className="text-white text-sm font-semibold">
            {formatWeekRange(monday)}
          </span>
          {!isCurrentWeek && (
            <span className="text-zinc-600 text-xs">tap for today</span>
          )}
        </button>

        <button
          onClick={() => navigate(1)}
          className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors text-xl"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => {
          const dayEvents = eventsForDay(day);
          const isToday = isSameDay(day, today);
          const isPast = isBeforeDay(day, today);

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                isToday
                  ? "bg-lime-400/10 ring-1 ring-lime-400/60"
                  : "hover:bg-zinc-800/80 active:bg-zinc-800"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isPast ? "text-zinc-700" : isToday ? "text-lime-400" : "text-zinc-500"
                }`}
              >
                {day.toLocaleDateString("en-GB", { weekday: "narrow" })}
              </span>
              <span
                className={`text-sm font-bold ${
                  isPast ? "text-zinc-700" : isToday ? "text-lime-400" : "text-white"
                }`}
              >
                {day.getDate()}
              </span>
              {/* Event dots */}
              <div className="flex gap-0.5 min-h-[6px] items-center">
                {dayEvents.slice(0, 3).map((e, j) => (
                  <span
                    key={j}
                    className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[e.eventType] ?? "bg-zinc-400"}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Event list */}
      {loading ? (
        <div className="py-10 text-center text-zinc-600 text-sm">Loading…</div>
      ) : hasAnyEvents ? (
        <div className="space-y-1">
          {weekDays.map((day, i) => {
            const dayEvents = eventsForDay(day);
            const isToday = isSameDay(day, today);
            if (dayEvents.length === 0 && !isToday) return null;

            return (
              <div key={i} className="space-y-1.5 pb-1">
                {/* Day label row */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setSelectedDay(day)}
                    className={`text-xs font-medium uppercase tracking-wider hover:text-white transition-colors ${
                      isToday ? "text-lime-400" : "text-zinc-500"
                    }`}
                  >
                    {day.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {isToday ? " · Today" : ""}
                  </button>
                  <button
                    onClick={() => openAdd(day)}
                    className="text-zinc-700 text-xs hover:text-zinc-400 transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {dayEvents.length === 0 ? (
                  <p className="text-zinc-800 text-xs pl-0.5">Rest day</p>
                ) : (
                  dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedDay(day)}
                      className="w-full text-left"
                    >
                      <EventChip event={event} />
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center space-y-2">
          <p className="text-zinc-600 text-sm">No sessions this week.</p>
          <p className="text-zinc-700 text-xs">
            Tap a day above or use + to add training.
          </p>
        </div>
      )}

      {/* Plan link */}
      <Link
        href="/plan"
        className="flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors border border-zinc-800"
      >
        <div>
          <p className="text-white text-sm font-medium">Fuelling plan</p>
          <p className="text-zinc-600 text-xs mt-0.5">View your 14-day plan</p>
        </div>
        <span className="text-lime-400 text-sm font-semibold">View →</span>
      </Link>

      {/* FAB */}
      <button
        onClick={() => openAdd(today)}
        className="fixed bottom-20 right-6 w-14 h-14 bg-lime-400 text-black rounded-full text-2xl font-bold shadow-xl hover:bg-lime-300 active:bg-lime-500 transition-colors flex items-center justify-center z-50"
        aria-label="Add session"
      >
        +
      </button>

      {addSheetOpen && (
        <AddEventSheet
          defaultDate={addDate}
          onClose={() => setAddSheetOpen(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
