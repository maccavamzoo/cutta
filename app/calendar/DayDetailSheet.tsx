"use client";

import { useState, useEffect } from "react";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import AddEventSheet from "@/app/plan/AddEventSheet";
import EditEventSheet, { type EditableEvent } from "@/components/EditEventSheet";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";

interface DayDetailResponse {
  date:       string;
  events:     {
    id:              number;
    title:           string;
    eventType:       string;
    scheduledAt:     string;
    durationMinutes: number | null;
    notes:           string | null;
  }[];
  plan: {
    meals:           { name: string; timing: string }[];
    totalCalories:   number | null;
    totalCarbsG:     number | null;
    totalProteinG:   number | null;
    totalFatG:       number | null;
    aiReasoning:     string | null;
    glycogenBattery: number | null;
  } | null;
  compliance: { compliance: string; notes: string | null } | null;
  feedback:   { feedbackType: string; rating: number }[];
  weighIn:    { weightKg: number; bodyFatPct: number | null } | null;
  training: {
    source:            string;
    durationMinutes:   number | null;
    distanceKm:        number | null;
    avgPowerWatts:     number | null;
    estimatedCalories: number | null;
    perceivedEffort:   string | null;
  } | null;
}

function complianceBadgeClass(c: string): string {
  if (c === "yes")    return "bg-lime-400/15 text-lime-400 border border-lime-400/30";
  if (c === "mostly") return "bg-amber-400/15 text-amber-400 border border-amber-400/30";
  return "bg-zinc-800 text-zinc-400 border border-zinc-700";
}

function feedbackLabel(type: string): string {
  if (type === "ride_energy") return "Energy";
  if (type === "gut_comfort") return "Gut";
  if (type === "hunger")      return "Hunger";
  return type;
}

interface Props {
  date:          string;
  timezone:      string;
  unitSystem:    UnitSystem;
  activityTypes: ActivityTypeOption[];
  onClose:       () => void;
  onDataChanged: () => void;
}

export default function DayDetailSheet({
  date,
  timezone,
  unitSystem,
  activityTypes,
  onClose,
  onDataChanged,
}: Props) {
  const [detail,       setDetail]       = useState<DayDetailResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [addingEvent,  setAddingEvent]  = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar/day?date=${date}`)
      .then((r) => r.json())
      .then((data: DayDetailResponse) => { setDetail(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  function refetch() {
    fetch(`/api/calendar/day?date=${date}`)
      .then((r) => r.json())
      .then((data: DayDetailResponse) => setDetail(data))
      .catch(() => undefined);
    onDataChanged();
  }

  // Format date heading using noon UTC to avoid any date-boundary issues
  const dateHeading = new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  // Default date for AddEventSheet: 09:00 in the user's timezone on this date
  const addEventDefault = new Date(`${date}T09:00:00`);

  const isEmpty = detail &&
    detail.events.length === 0 &&
    !detail.plan &&
    !detail.compliance &&
    !detail.training &&
    !detail.weighIn;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl px-4 pt-3 pb-10 max-w-lg mx-auto overflow-y-auto max-h-[85dvh]">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">{dateHeading}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm transition-colors">
            Close
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && detail && (
          <div className="space-y-6">

            {/* Weigh-in */}
            {detail.weighIn && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Weight</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-lg font-bold tabular-nums">
                    {kgToDisplay(detail.weighIn.weightKg, unitSystem).toFixed(1)}
                  </span>
                  <span className="text-zinc-500 text-sm">{weightLabel(unitSystem)}</span>
                  {detail.weighIn.bodyFatPct != null && (
                    <span className="text-zinc-600 text-xs">· {detail.weighIn.bodyFatPct.toFixed(1)}% bf</span>
                  )}
                </div>
              </div>
            )}

            {/* Events */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sessions</p>
              {detail.events.length > 0 ? (
                <div className="space-y-2">
                  {detail.events.map((ev) => {
                    const time = new Date(ev.scheduledAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit", minute: "2-digit", timeZone: timezone,
                    });
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setEditingEvent({
                          id:              ev.id,
                          title:           ev.title,
                          eventType:       ev.eventType,
                          scheduledAt:     ev.scheduledAt,
                          durationMinutes: ev.durationMinutes,
                          notes:           ev.notes,
                        })}
                        className="w-full text-left bg-zinc-800/60 rounded-xl px-3 py-2.5 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white text-sm font-medium truncate">{ev.title}</span>
                          <span className="text-zinc-600 text-xs shrink-0">Edit →</span>
                        </div>
                        <div className="flex gap-2 mt-0.5 text-xs text-zinc-500">
                          <span>{ev.eventType}</span>
                          <span>·</span>
                          <span>{time}</span>
                          {ev.durationMinutes && <><span>·</span><span>{ev.durationMinutes}min</span></>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-600 text-sm">No sessions</p>
              )}
              <button
                onClick={() => setAddingEvent(true)}
                className="mt-2 w-full py-2 border border-dashed border-zinc-700 rounded-xl text-zinc-600 text-xs hover:border-zinc-500 hover:text-zinc-400 transition-colors"
              >
                + Add session
              </button>
            </div>

            {/* Fuelling plan */}
            {detail.plan && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fuelling plan</p>
                <div className="flex gap-3 text-xs tabular-nums mb-2">
                  {detail.plan.totalCalories && (
                    <span className="text-white font-semibold">{detail.plan.totalCalories} kcal</span>
                  )}
                  {detail.plan.totalCarbsG && (
                    <span className="text-zinc-500">C <span className="text-zinc-300">{detail.plan.totalCarbsG}g</span></span>
                  )}
                  {detail.plan.totalProteinG && (
                    <span className="text-zinc-500">P <span className="text-zinc-300">{detail.plan.totalProteinG}g</span></span>
                  )}
                  {detail.plan.totalFatG && (
                    <span className="text-zinc-500">F <span className="text-zinc-300">{detail.plan.totalFatG}g</span></span>
                  )}
                </div>
                {detail.plan.aiReasoning && (
                  <p className="text-zinc-600 text-xs italic mb-2">&ldquo;{detail.plan.aiReasoning}&rdquo;</p>
                )}
                {detail.plan.meals.length > 0 && (
                  <div className="space-y-1">
                    {detail.plan.meals.map((m, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-300">{m.name}</span>
                        <span className="text-zinc-600">{m.timing}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Check-in + feedback */}
            {detail.compliance && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Check-in</p>
                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize ${complianceBadgeClass(detail.compliance.compliance)}`}>
                  {detail.compliance.compliance}
                </span>
                {detail.compliance.notes && (
                  <p className="text-zinc-500 text-xs mt-1.5 italic">{detail.compliance.notes}</p>
                )}
                {detail.feedback.length > 0 && (
                  <p className="text-zinc-500 text-xs mt-2">
                    {detail.feedback
                      .map((f) => `${feedbackLabel(f.feedbackType)}: ${f.rating}/5`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}

            {/* Training */}
            {detail.training && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Training logged</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  {detail.training.durationMinutes && <span>{detail.training.durationMinutes}min</span>}
                  {detail.training.distanceKm && <span>{Number(detail.training.distanceKm).toFixed(1)}km</span>}
                  {detail.training.avgPowerWatts && <span>{detail.training.avgPowerWatts}W avg</span>}
                  {detail.training.estimatedCalories && <span>{detail.training.estimatedCalories}kcal</span>}
                  {detail.training.perceivedEffort && (
                    <span className="capitalize">{detail.training.perceivedEffort}</span>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {isEmpty && (
              <div className="py-8 text-center">
                <p className="text-zinc-500 text-sm">Nothing logged</p>
                <button
                  onClick={() => setAddingEvent(true)}
                  className="mt-3 text-lime-400 text-sm font-medium"
                >
                  Add a session +
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit event sheet */}
      {editingEvent && (
        <EditEventSheet
          event={editingEvent}
          activityTypes={activityTypes}
          onClose={() => setEditingEvent(null)}
          onUpdated={() => { setEditingEvent(null); refetch(); }}
          onDeleted={() => { setEditingEvent(null); refetch(); }}
        />
      )}

      {/* Add event sheet */}
      {addingEvent && (
        <AddEventSheet
          defaultDate={addEventDefault}
          activityTypes={activityTypes}
          onClose={() => setAddingEvent(false)}
          onAdded={() => { setAddingEvent(false); refetch(); }}
        />
      )}
    </>
  );
}
