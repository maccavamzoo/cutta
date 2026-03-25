"use client";

import { useState, useCallback } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  display:    string;
  totalGrams: number;
  category:   string;
}

interface DayItems {
  date:  string;
  items: ShoppingItem[];
}

// items JSONB can be either the new { aggregated, byDay } shape
// or the legacy flat array (from rows generated before this change)
type ItemsPayload =
  | { aggregated: ShoppingItem[]; byDay: DayItems[] }
  | ShoppingItem[];

export interface ShoppingList {
  id:                number;
  generatedForStart: string;
  generatedForEnd:   string;
  generatedAt:       string;
  items:             ItemsPayload;
}

function resolveItems(items: ItemsPayload): { all: ShoppingItem[]; byDay: DayItems[] } {
  if (Array.isArray(items)) return { all: items, byDay: [] };
  return { all: items.aggregated, byDay: items.byDay };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
      weekday: "short",
      day:     "numeric",
      month:   "short",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtGrams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1).replace(/\.0$/, "")}kg`;
  return `${g}g`;
}

// Distinct colour per category
const CATEGORY_COLOUR: Record<string, string> = {
  "Protein":      "text-blue-400  border-blue-400/20  bg-blue-400/5",
  "Carbs":        "text-amber-400 border-amber-400/20 bg-amber-400/5",
  "Fruit & Veg":  "text-lime-400  border-lime-400/20  bg-lime-400/5",
  "Dairy":        "text-cyan-400  border-cyan-400/20  bg-cyan-400/5",
  "Fats & Oils":  "text-orange-400 border-orange-400/20 bg-orange-400/5",
  "Supplements":  "text-violet-400 border-violet-400/20 bg-violet-400/5",
  "Other":        "text-zinc-400  border-zinc-700      bg-zinc-900",
};

function categoryColour(cat: string) {
  return CATEGORY_COLOUR[cat] ?? CATEGORY_COLOUR["Other"];
}

// ─── category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  items,
  ticked,
  onToggle,
}: {
  category: string;
  items:    ShoppingItem[];
  ticked:   Set<string>;
  onToggle: (key: string) => void;
}) {
  const colour  = categoryColour(category);
  const allDone = items.every((it) => ticked.has(it.display.toLowerCase()));

  return (
    <div className={`rounded-2xl border overflow-hidden ${colour}`}>
      {/* Category header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className={`text-xs font-semibold uppercase tracking-wider ${colour.split(" ")[0]}`}>
          {category}
        </p>
        {allDone && (
          <span className="text-xs text-zinc-600">all done</span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-white/5">
        {items.map((item) => {
          const key    = item.display.toLowerCase();
          const bought = ticked.has(key);
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:bg-white/5 ${
                bought ? "opacity-50" : ""
              }`}
            >
              {/* Checkbox */}
              <span
                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  bought
                    ? "bg-lime-400 border-lime-400"
                    : "border-zinc-600 bg-transparent"
                }`}
              >
                {bought && (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="black"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>

              {/* Label */}
              <span
                className={`flex-1 text-sm transition-colors ${
                  bought
                    ? "text-zinc-500 line-through decoration-zinc-500 decoration-2"
                    : "text-zinc-200"
                }`}
              >
                {item.display}
              </span>

              {/* Amount */}
              <span
                className={`text-xs tabular-nums shrink-0 transition-colors ${
                  bought ? "text-zinc-700" : "text-zinc-500"
                }`}
              >
                {fmtGrams(item.totalGrams)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function fmtDayLabel(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

const CATEGORY_ORDER = ["Protein", "Carbs", "Fruit & Veg", "Dairy", "Fats & Oils", "Supplements", "Other"];

function groupByCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
  return items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});
}

export default function ShoppingView({
  initialList,
}: {
  initialList: ShoppingList | null;
}) {
  const [list,      setList]     = useState<ShoppingList | null>(initialList);
  const [ticked,    setTicked]   = useState<Set<string>>(new Set());
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState<string | null>(null);
  // null = show all; index = show that day's items
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTicked(new Set());
    setDayFilter(null);

    try {
      const res = await fetch("/api/shopping-list", { method: "POST" });

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server error — check ANTHROPIC_API_KEY in environment");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setList(data.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate list");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleItem = useCallback((key: string) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else               next.add(key);
      return next;
    });
  }, []);

  const { all: allItems, byDay } = list ? resolveItems(list.items) : { all: [], byDay: [] };

  // Active items based on filter
  const activeItems = dayFilter !== null && byDay[dayFilter]
    ? byDay[dayFilter].items
    : allItems;

  const grouped    = groupByCategory(activeItems);
  const categories = Object.keys(grouped).sort((a, b) =>
    (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99)
  );

  const totalItems  = activeItems.length;
  const tickedCount = activeItems.filter((it) => ticked.has(it.display.toLowerCase())).length;

  return (
    <div className="space-y-5">
      {/* Generate button + meta */}
      <div className="space-y-3">
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-3.5 bg-lime-400 text-black font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading
            ? "Generating…"
            : list
            ? "Regenerate list"
            : "Generate shopping list"}
        </button>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {list && !error && (
          <div className="flex items-center justify-between px-1">
            <p className="text-zinc-600 text-xs">
              {fmtDateRange(list.generatedForStart, list.generatedForEnd)}
            </p>
            <p className="text-zinc-500 text-xs">
              {tickedCount}/{totalItems} items
            </p>
          </div>
        )}
      </div>

      {/* Day filter toggle — only shown when per-day data is available */}
      {byDay.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setDayFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              dayFilter === null
                ? "bg-lime-400 text-black"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            All {byDay.length} days
          </button>
          {byDay.map((day, i) => (
            <button
              key={day.date}
              onClick={() => setDayFilter(dayFilter === i ? null : i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                dayFilter === i
                  ? "bg-lime-400 text-black"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {fmtDayLabel(day.date)}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {totalItems > 0 && (
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-400 rounded-full transition-all duration-300"
            style={{ width: `${(tickedCount / totalItems) * 100}%` }}
          />
        </div>
      )}

      {/* Category sections */}
      {categories.length > 0 && (
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              items={grouped[cat]}
              ticked={ticked}
              onToggle={toggleItem}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!list && !loading && (
        <div className="py-12 text-center space-y-2">
          <p className="text-zinc-400 font-medium">No shopping list yet</p>
          <p className="text-zinc-600 text-sm max-w-xs mx-auto leading-relaxed">
            Generates from your next 3 days of fuelling plans. Make sure your plan is up to date first.
          </p>
        </div>
      )}

      {/* All done state */}
      {tickedCount > 0 && tickedCount === totalItems && (
        <div className="text-center py-4">
          <p className="text-lime-400 font-semibold text-sm">All done — good to go!</p>
        </div>
      )}
    </div>
  );
}
