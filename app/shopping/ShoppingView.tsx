"use client";

import { useState, useRef, useEffect } from "react";

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

interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["protein", "carbs", "fats", "vegetables", "dairy", "supplements", "other"];

const CATEGORY_LABELS: Record<string, string> = {
  protein:     "Protein",
  carbs:       "Carbs & Grains",
  fats:        "Fats & Nuts",
  vegetables:  "Vegetables",
  dairy:       "Dairy",
  supplements: "Supplements",
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
  const [strategy, setStrategy]               = useState<WeeklyStrategy | null>(initialStrategy);
  const [checked, setChecked]                 = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen]               = useState(false);
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [input, setInput]                     = useState("");
  const [chatLoading, setChatLoading]         = useState(false);
  const [applying, setApplying]               = useState(false);
  const [pickingTemplate, setPickingTemplate] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // ── Template picker ────────────────────────────────────────────────────────

  async function selectTemplate(index: number) {
    setLoadingTemplate(index);
    try {
      const res = await fetch("/api/weekly-strategy", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ templateIndex: index }),
      });
      const data = await res.json() as { strategy: WeeklyStrategy };
      if (res.ok) {
        setStrategy(data.strategy);
        setChecked(new Set());
        setMessages([]);
        setPickingTemplate(false);
        setChatOpen(false);
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

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/weekly-strategy/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json() as { reply: string; hasProposedUpdate: boolean };
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.hasProposedUpdate) {
          const sr = await fetch("/api/weekly-strategy");
          const sd = await sr.json() as { strategy: WeeklyStrategy | null };
          if (sd.strategy) setStrategy(sd.strategy);
        }
      }
    } finally {
      setChatLoading(false);
    }
  }

  // ── Confirm proposed update ───────────────────────────────────────────────

  async function applyUpdate() {
    setApplying(true);
    try {
      const res = await fetch("/api/weekly-strategy/confirm", { method: "POST" });
      const data = await res.json() as { strategy: WeeklyStrategy };
      if (res.ok) {
        setStrategy(data.strategy);
        setChecked(new Set());
      }
    } finally {
      setApplying(false);
    }
  }

  function discardUpdate() {
    if (!strategy) return;
    setStrategy({ ...strategy, proposedUpdate: null });
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

  // ── No strategy — show template picker ────────────────────────────────────

  if (!strategy) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-white">Shopping</h1>
          <p className="text-zinc-500 text-sm mt-1">Choose a weekly strategy to get started.</p>
        </div>
        <div className="space-y-3">
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
      </div>
    );
  }

  // ── Template picker overlay ────────────────────────────────────────────────

  if (pickingTemplate) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setPickingTemplate(false)}
            className="text-zinc-400 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white">Change strategy</h1>
        </div>
        <p className="text-zinc-500 text-sm mb-4">
          Starting a new strategy will replace your current one.
        </p>
        <div className="space-y-3">
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
      </div>
    );
  }

  // ── Active strategy view ───────────────────────────────────────────────────

  const groups = groupedItems(strategy.shoppingItems);
  const checkedCount = strategy.shoppingItems.filter((it) => checked.has(itemKey(it))).length;
  const total        = strategy.shoppingItems.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Shopping</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{strategy.name}</p>
          {strategy.weekOverview && (
            <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{strategy.weekOverview}</p>
          )}
        </div>
        <button
          onClick={() => setPickingTemplate(true)}
          className="text-zinc-500 hover:text-zinc-300 text-xs mt-1"
        >
          Change
        </button>
      </div>

      {/* Proposed update banner */}
      {strategy.proposedUpdate && (
        <div className="mb-4 bg-zinc-900 border border-lime-400/40 rounded-xl p-4">
          <p className="text-lime-400 text-sm font-semibold mb-1">AI has suggested changes</p>
          <p className="text-zinc-400 text-xs mb-3">
            Review the chat below to see what was proposed, then apply or discard.
          </p>
          <div className="flex gap-2">
            <button
              onClick={applyUpdate}
              disabled={applying}
              className="flex-1 bg-lime-400 text-black text-xs font-semibold py-2 rounded-lg disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply changes"}
            </button>
            <button
              onClick={discardUpdate}
              disabled={applying}
              className="flex-1 bg-zinc-800 text-zinc-300 text-xs font-semibold py-2 rounded-lg disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Progress + copy */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-zinc-500 text-xs">
          {checkedCount} of {total} items
        </span>
        <button
          onClick={copyUnchecked}
          className="text-zinc-400 hover:text-white text-xs border border-zinc-700 rounded-lg px-3 py-1.5"
        >
          Copy remaining
        </button>
      </div>

      {/* Shopping list */}
      <div className="space-y-5 mb-6">
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
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${
                        done ? "bg-lime-400 border-lime-400" : "border-zinc-600"
                      }`}
                    >
                      {done && (
                        <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 8">
                          <path
                            d="M1 4l3 3 5-6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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

      {/* All done state */}
      {checkedCount > 0 && checkedCount === total && (
        <div className="text-center py-4 mb-4">
          <p className="text-lime-400 font-semibold text-sm">All done — good to go!</p>
        </div>
      )}

      {/* AI Chat toggle */}
      <div className="border-t border-zinc-800 pt-4">
        <button
          onClick={() => setChatOpen((o) => !o)}
          className="w-full flex items-center justify-between text-zinc-400 hover:text-white text-sm py-1"
        >
          <span>✨ Tweak with AI</span>
          <span className="text-xs">{chatOpen ? "▼" : "▲"}</span>
        </button>

        {chatOpen && (
          <div className="mt-3">
            <div className="space-y-3 mb-3 max-h-80 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-zinc-600 text-xs">
                  Ask me to swap ingredients, adjust amounts, or tailor the list to your preferences.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-xl px-3 py-2 ${
                    m.role === "user"
                      ? "bg-zinc-800 text-white ml-6"
                      : "bg-zinc-900 text-zinc-200 mr-6"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div className="bg-zinc-900 text-zinc-500 text-sm rounded-xl px-3 py-2 mr-6 animate-pulse">
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="e.g. swap salmon for tuna, add cottage cheese…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                disabled={chatLoading}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !input.trim()}
                className="bg-lime-400 text-black text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
