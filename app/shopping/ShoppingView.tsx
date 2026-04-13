"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  item:     string;
  category: string;
  amount:   string;
}

export interface WeeklyStrategy {
  id:             number;
  name:           string;
  weekOverview:   string | null;
  ingredientPool: string[];
  shoppingItems:  ShoppingItem[];
  proposedUpdate: { ingredientPool?: string[]; shoppingItems?: ShoppingItem[] } | null;
  aiReasoning:    string | null;
}

interface TemplateMeta {
  name:  string;
  focus: string;
  days:  number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_ORDER  = ["protein", "carbs", "fats", "vegetables", "dairy", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  protein:     "Protein",
  carbs:       "Carbs & Grains",
  fats:        "Fats & Nuts",
  vegetables:  "Vegetables",
  dairy:       "Dairy",
  other:       "Other",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShoppingView({
  initialStrategy,
  templateNames,
}: {
  initialStrategy: WeeklyStrategy | null;
  templateNames:   TemplateMeta[];
}) {
  const [strategy,        setStrategy]        = useState<WeeklyStrategy | null>(initialStrategy);
  const [checked,         setChecked]         = useState<Set<string>>(new Set());
  const [loadingTemplate, setLoadingTemplate] = useState<number | null>(null);

  // ── Template picker ───────────────────────────────────────────────────────

  async function selectTemplate(index: number) {
    setLoadingTemplate(index);
    try {
      const res  = await fetch("/api/weekly-strategy", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ templateIndex: index }),
      });
      const data = await res.json() as { strategy: WeeklyStrategy };
      if (res.ok) {
        setStrategy(data.strategy);
        setChecked(new Set());
      }
    } finally {
      setLoadingTemplate(null);
    }
  }

  // ── Checklist ─────────────────────────────────────────────────────────────

  function toggleCheck(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function copyUnchecked() {
    if (!strategy) return;
    const lines = strategy.shoppingItems
      .filter((it) => !checked.has(itemKey(it)))
      .map((it) => `${it.item} — ${it.amount}`);
    navigator.clipboard.writeText(lines.join("\n"));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function itemKey(it: ShoppingItem) {
    return `${it.item}::${it.category}`;
  }

  function groupedItems(items: ShoppingItem[]) {
    const groups: Record<string, ShoppingItem[]> = {};
    for (const it of items) {
      const cat = CATEGORY_ORDER.includes(it.category) ? it.category : "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    }
    return CATEGORY_ORDER.filter((c) => groups[c]?.length).map((c) => ({
      category: c,
      label:    CATEGORY_LABELS[c] ?? c,
      items:    groups[c],
    }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const groups       = strategy ? groupedItems(strategy.shoppingItems) : [];
  const checkedCount = strategy ? strategy.shoppingItems.filter((it) => checked.has(itemKey(it))).length : 0;
  const total        = strategy?.shoppingItems.length ?? 0;

  return (
    <>
      <div className="space-y-6 pb-20">

        {/* Page heading */}
        <h1 className="text-xl font-bold tracking-tight text-white">Shopping</h1>

        {/* No strategy: template picker */}
        {!strategy && (
          <div className="space-y-3">
            <p className="text-zinc-500 text-sm">
              Choose a weekly template to set up your ingredient pool and shopping list.
            </p>
            {templateNames.map((t, i) => (
              <button
                key={i}
                onClick={() => selectTemplate(i)}
                disabled={loadingTemplate !== null}
                className="w-full text-left bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{t.name}</span>
                  <span className="text-zinc-500 text-xs">{t.days} training days</span>
                </div>
                <p className="text-zinc-400 text-xs mt-1 leading-snug">{t.focus}</p>
                {loadingTemplate === i && (
                  <p className="text-lime-400 text-xs mt-2">Setting up…</p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Has strategy: checklist */}
        {strategy && (
          <div className="space-y-4">
            {/* Strategy header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-semibold">{strategy.name}</p>
                {strategy.weekOverview && (
                  <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{strategy.weekOverview}</p>
                )}
              </div>
              <button
                onClick={() => setStrategy(null)}
                className="text-zinc-600 hover:text-zinc-400 text-xs shrink-0 mt-0.5 transition-colors"
              >
                Change setup
              </button>
            </div>

            {/* Progress + copy */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">{checkedCount} of {total} items</span>
              <button
                onClick={copyUnchecked}
                className="text-zinc-400 hover:text-white text-xs border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
              >
                Copy unchecked
              </button>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lime-400 rounded-full transition-all duration-300"
                  style={{ width: `${(checkedCount / total) * 100}%` }}
                />
              </div>
            )}

            {/* Grouped checklist */}
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.category}>
                  <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    {g.label}
                  </h2>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      const key  = itemKey(it);
                      const done = checked.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCheck(key)}
                          className="w-full flex items-center gap-3 bg-zinc-900 rounded-lg px-3 py-2.5 text-left"
                        >
                          <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${done ? "bg-lime-400 border-lime-400" : "border-zinc-600"}`}>
                            {done && (
                              <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 8">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={`flex-1 text-sm ${done ? "text-zinc-600 line-through" : "text-white"}`}>
                            {it.item}
                          </span>
                          <span className={`text-xs ${done ? "text-zinc-700" : "text-zinc-500"}`}>
                            {it.amount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* All done */}
            {checkedCount > 0 && checkedCount === total && (
              <p className="text-lime-400 font-semibold text-sm text-center py-2">
                All done — good to go!
              </p>
            )}
          </div>
        )}

        {/* Link to AI advisor */}
        <p className="text-zinc-600 text-xs text-center">
          Want to customise?{" "}
          <Link href="/advisor" className="text-lime-600 hover:text-lime-400 transition-colors">
            Chat with Cutta AI →
          </Link>
        </p>
      </div>

      <BottomNav active="settings" />
    </>
  );
}
