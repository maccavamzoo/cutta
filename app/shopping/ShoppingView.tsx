"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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

interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

type Tab = "shopping" | "ai";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_ORDER  = ["protein", "carbs", "fats", "vegetables", "dairy", "supplements", "other"];
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
  const router = useRouter();

  const [tab,             setTab]             = useState<Tab>("shopping");
  const [strategy,        setStrategy]        = useState<WeeklyStrategy | null>(initialStrategy);
  const [checked,         setChecked]         = useState<Set<string>>(new Set());
  const [loadingTemplate, setLoadingTemplate] = useState<number | null>(null);

  // AI chat state
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [applying,    setApplying]    = useState(false);

  // Pending-change nav guard (mirrors ProtocolPageShell)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const hasPendingUpdate = strategy?.proposedUpdate != null;

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (tab === "ai") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [tab]);

  // ── Navigation guard ──────────────────────────────────────────────────────

  function handleNavigate(href: string): boolean {
    if (hasPendingUpdate) {
      setPendingNavigation(href);
      return false;
    }
    return true;
  }

  function confirmLeave() {
    if (pendingNavigation) router.push(pendingNavigation);
    setPendingNavigation(null);
  }

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
        setMessages([]);
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

  // ── AI chat ───────────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || chatLoading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setChatLoading(true);
    try {
      const res  = await fetch("/api/weekly-strategy/chat", {
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

  // ── Proposed update ───────────────────────────────────────────────────────

  async function applyUpdate() {
    setApplying(true);
    try {
      const res  = await fetch("/api/weekly-strategy/confirm", { method: "POST" });
      const data = await res.json() as { strategy: WeeklyStrategy };
      if (res.ok) {
        setStrategy(data.strategy);
        setChecked(new Set());
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Changes applied — shopping list updated." },
        ]);
      }
    } finally {
      setApplying(false);
    }
  }

  function discardUpdate() {
    if (!strategy) return;
    setStrategy({ ...strategy, proposedUpdate: null });
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Changes discarded — list unchanged." },
    ]);
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

        {/* Tab bar */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
          {/* Shopping — plain underline tab */}
          <button
            type="button"
            onClick={() => setTab("shopping")}
            className={`text-sm font-semibold transition-colors pb-0 ${
              tab === "shopping"
                ? "text-lime-400 border-b-2 border-lime-400 -mb-3 pb-3"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Shopping
          </button>

          {/* Tweak with AI — pill style */}
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`transition-colors rounded-full px-4 py-1.5 text-sm font-medium border ${
              tab === "ai"
                ? "bg-sky-500/25 text-sky-400 border-sky-400/50"
                : "bg-sky-500/15 text-sky-400 border-sky-400/30 hover:bg-sky-500/25"
            }`}
          >
            ✨ Tweak with AI
          </button>
        </div>

        {/* ── Shopping tab ─────────────────────────────────────────────────── */}
        {tab === "shopping" && (
          <div className="space-y-5">

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
          </div>
        )}

        {/* ── Tweak with AI tab ─────────────────────────────────────────────── */}
        {tab === "ai" && (
          <div className="space-y-4">

            {/* No strategy: prompt to pick one first */}
            {!strategy && (
              <p className="text-zinc-500 text-sm">
                Pick a template on the Shopping tab first, then come here to customise it.
              </p>
            )}

            {/* Has strategy: chat panel */}
            {strategy && (
              <>
                <p className="text-zinc-500 text-xs">Active: {strategy.name}</p>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col">
                  {/* Message area */}
                  <div className="flex-1 overflow-y-auto max-h-[55vh] p-4 space-y-3">
                    {messages.length === 0 && (
                      <p className="text-zinc-600 text-sm text-center py-4">
                        Ask me to swap ingredients, adjust amounts, or tailor the list to your preferences.
                      </p>
                    )}

                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          m.role === "user"
                            ? "bg-lime-400/10 border border-lime-400/20 text-zinc-100 rounded-br-sm"
                            : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    ))}

                    {/* Proposed update card — inline in chat */}
                    {strategy.proposedUpdate && (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" />
                          <p className="text-zinc-200 text-sm font-semibold">Shopping list update proposed</p>
                        </div>
                        <p className="text-zinc-400 text-xs">
                          Applying will update your ingredient pool and shopping list.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={applyUpdate}
                            disabled={applying}
                            className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold disabled:opacity-50"
                          >
                            {applying ? "Applying…" : "Apply changes"}
                          </button>
                          <button
                            onClick={discardUpdate}
                            disabled={applying}
                            className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Loading indicator */}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}

                    <div ref={chatBottomRef} />
                  </div>

                  {/* Input bar */}
                  <div className="border-t border-zinc-800 p-3 flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      disabled={chatLoading}
                      placeholder="Ask a question or request a change…"
                      className="flex-1 bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || chatLoading}
                      className="px-4 py-2.5 rounded-xl bg-lime-400 text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav — with pending-change guard */}
      <BottomNav active="more" onNavigate={handleNavigate} />

      {/* Pending-change navigation modal */}
      {pendingNavigation && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setPendingNavigation(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-sm w-full space-y-4">
              <p className="text-white font-semibold">Pending shopping list change</p>
              <p className="text-zinc-400 text-sm">
                You have a proposed change that hasn&apos;t been applied yet. Leave without applying?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingNavigation(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400 text-black"
                >
                  Stay
                </button>
                <button
                  onClick={confirmLeave}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-300"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
