"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import type { ProtocolFile } from "@/lib/protocol";

// SpeechRecognition types (not guaranteed in lib.dom.d.ts)
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length:  number;
  [index: number]:  SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results:     SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  continuous:     boolean;
  interimResults: boolean;
  lang:           string;
  start():        void;
  stop():         void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror:  ((event: Event) => void) | null;
  onend:    (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition:       new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ApiResponse {
  reply:                   string;
  proposedProtocolUpdate:  ProtocolFile | null;
  proposedStrategyUpdate:  { ingredientPool: string[]; shoppingItems: unknown[] } | null;
  protocolValidationError: string | null;
  strategyValidationError: string | null;
}

// ─── Loading dots ────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdvisorView({ initialChatHistory = [] }: { initialChatHistory?: Message[] }) {
  const router = useRouter();

  const [messages,  setMessages]  = useState<Message[]>(initialChatHistory);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);

  // Protocol update flow
  const [pendingProtocol,  setPendingProtocol]  = useState<ProtocolFile | null>(null);
  const [showNamingCard,   setShowNamingCard]   = useState(false);
  const [proposedName,     setProposedName]      = useState("");
  const [savingProtocol,   setSavingProtocol]   = useState(false);

  // Strategy update flow
  const [pendingStrategy,  setPendingStrategy]  = useState<{ ingredientPool: string[]; shoppingItems: unknown[] } | null>(null);
  const [applyingStrategy, setApplyingStrategy] = useState(false);

  // Navigation guard
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const hasPending = pendingProtocol !== null || pendingStrategy !== null;

  // Mic / speech recognition
  const [hasSpeech,  setHasSpeech]  = useState(false);
  const [listening,  setListening]  = useState(false);
  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const preRecordTextRef = useRef<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasSpeech(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Snapshot whatever is already in the input so we can prepend it
    preRecordTextRef.current = input;

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    const recognition = new SR();
    recognition.continuous     = !isMobile; // single utterance on mobile, continuous on desktop
    recognition.interimResults = true;
    recognition.lang           = "en-GB";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild full transcript from ALL results on every event — no delta accumulation
      let full = "";
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      const prefix = preRecordTextRef.current;
      setInput(prefix ? prefix + " " + full : full);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend   = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // ── History persistence ─────────────────────────────────────────────────

  async function saveHistory(history: Message[]) {
    await fetch("/api/advisor/history", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chatHistory: history }),
    });
  }

  async function handleClearChat() {
    setMessages([]);
    setPendingProtocol(null);
    setPendingStrategy(null);
    setShowNamingCard(false);
    await saveHistory([]);
  }

  // ── Send message ────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/advisor/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages,
        }),
      });

      const data = await res.json() as ApiResponse;

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: (data as { error?: string }).error ?? "Something went wrong. Please try again." }]);
        return;
      }

      const updatedMessages: Message[] = [...messages, { role: "user", content: text }, { role: "assistant", content: data.reply }];
      setMessages(updatedMessages);
      void saveHistory(updatedMessages);

      if (data.proposedProtocolUpdate) {
        setPendingProtocol(data.proposedProtocolUpdate);
        setShowNamingCard(false);
        setProposedName(`${data.proposedProtocolUpdate.protocol_name} (modified)`);
      }
      if (data.protocolValidationError) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Note: protocol update couldn't be validated — ${data.protocolValidationError}` }]);
      }

      if (data.proposedStrategyUpdate) {
        setPendingStrategy(data.proposedStrategyUpdate);
      }
      if (data.strategyValidationError) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Note: shopping update couldn't be validated — ${data.strategyValidationError}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Protocol update flow ────────────────────────────────────────────────

  function handleApplyProtocolClick() {
    setShowNamingCard(true);
  }

  async function handleConfirmProtocolSave() {
    if (!pendingProtocol || !proposedName.trim()) return;
    setSavingProtocol(true);
    try {
      const res = await fetch("/api/protocol", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingProtocol, protocol_name: proposedName.trim(), saveAsTemplate: true }),
      });
      if (res.ok) {
        setPendingProtocol(null);
        setShowNamingCard(false);
        setMessages((prev) => [...prev, { role: "assistant", content: `Protocol saved as "${proposedName.trim()}". Your plans will use the new rules next time they generate.` }]);
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        setMessages((prev) => [...prev, { role: "assistant", content: `Failed to save: ${data.error ?? "unknown error"}` }]);
        setShowNamingCard(false);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error while saving." }]);
      setShowNamingCard(false);
    } finally {
      setSavingProtocol(false);
    }
  }

  function handleRejectProtocol() {
    setPendingProtocol(null);
    setShowNamingCard(false);
    setMessages((prev) => [...prev, { role: "assistant", content: "Protocol change rejected — unchanged." }]);
  }

  // ── Strategy update flow ────────────────────────────────────────────────

  async function handleApplyStrategy() {
    setApplyingStrategy(true);
    try {
      const res = await fetch("/api/weekly-strategy/confirm", { method: "POST" });
      if (res.ok) {
        setPendingStrategy(null);
        setMessages((prev) => [...prev, { role: "assistant", content: "Shopping list updated." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to apply shopping update." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error while applying." }]);
    } finally {
      setApplyingStrategy(false);
    }
  }

  function handleRejectStrategy() {
    setPendingStrategy(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "Shopping change rejected — unchanged." }]);
  }

  // ── Navigation guard ────────────────────────────────────────────────────

  function handleNavigate(href: string): boolean {
    if (hasPending) {
      setPendingNav(href);
      return false;
    }
    return true;
  }

  function confirmLeave() {
    if (pendingNav) router.push(pendingNav);
    setPendingNav(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header — sticky so it stays visible while messages scroll */}
      <div className="sticky top-0 z-30 bg-black px-4 pt-5 pb-3 border-b border-zinc-800">
        <div className="max-w-lg mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Cutta AI</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Nutrition, training &amp; protocol advice</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors mt-1"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Messages — scrollable, padded so last message clears input bar + nav */}
      <div ref={scrollRef} className="px-4 py-4 pb-[140px]">
        <div className="max-w-lg mx-auto space-y-3">

            {messages.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <p className="text-zinc-400 text-sm font-medium">Ask me anything</p>
                <p className="text-zinc-600 text-xs leading-relaxed max-w-xs mx-auto">
                  Nutrition questions, protocol tweaks, shopping list help, training fuelling advice — all in one place.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-lime-400/10 border border-lime-400/20 text-zinc-100 rounded-br-sm"
                    : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Protocol update card */}
            {pendingProtocol && !showNamingCard && (
              <div className="rounded-xl border border-lime-400/30 bg-zinc-800/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" />
                  <p className="text-zinc-200 text-sm font-semibold">Protocol update proposed</p>
                </div>
                <p className="text-zinc-400 text-xs">Applying will replace your current active protocol.</p>
                <div className="flex gap-2">
                  <button onClick={handleApplyProtocolClick} className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold">
                    Apply changes
                  </button>
                  <button onClick={handleRejectProtocol} className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold">
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Protocol naming card */}
            {pendingProtocol && showNamingCard && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 space-y-3">
                <p className="text-zinc-200 text-sm font-semibold">Name this protocol</p>
                <input
                  type="text"
                  value={proposedName}
                  onChange={(e) => setProposedName(e.target.value)}
                  placeholder="Protocol name…"
                  className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmProtocolSave}
                    disabled={savingProtocol || !proposedName.trim()}
                    className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold disabled:opacity-50"
                  >
                    {savingProtocol ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setShowNamingCard(false)}
                    disabled={savingProtocol}
                    className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Strategy update card */}
            {pendingStrategy && (
              <div className="rounded-xl border border-sky-400/30 bg-zinc-800/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <p className="text-zinc-200 text-sm font-semibold">Shopping list update proposed</p>
                </div>
                <p className="text-zinc-400 text-xs">
                  Ingredient pool: {pendingStrategy.ingredientPool.slice(0, 5).join(", ")}{pendingStrategy.ingredientPool.length > 5 ? ` +${pendingStrategy.ingredientPool.length - 5} more` : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyStrategy}
                    disabled={applyingStrategy}
                    className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold disabled:opacity-50"
                  >
                    {applyingStrategy ? "Applying…" : "Apply changes"}
                  </button>
                  <button
                    onClick={handleRejectStrategy}
                    disabled={applyingStrategy}
                    className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {loading && <LoadingDots />}
          </div>
        </div>

      {/* Input bar — fixed above BottomNav */}
      <div className="fixed bottom-[58] left-0 right-0 bg-black z-30" style={{ boxShadow: "0 -1px 0 0 rgb(39 39 42)" }}>
        <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-2.5">

          {/* Mic button */}
          {hasSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                listening
                  ? "bg-red-500/20 border border-red-500/30 text-red-400 animate-pulse"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
              }`}
              aria-label={listening ? "Stop recording" : "Voice input"}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="1" width="6" height="10" rx="3" />
                <path d="M3 8a6 6 0 0 0 12 0" />
                <path d="M9 14v3" />
              </svg>
            </button>
          )}

          {/* Log training button */}
          <button
            type="button"
            onClick={() => router.push("/training/upload")}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            aria-label="Log training"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" stroke="none" />
              <path d="M12 17.5V14l-3-3 4-3 2 3h3" />
            </svg>
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={loading}
            placeholder="Ask anything…"
            className="flex-1 m-0 bg-zinc-900 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-700 disabled:opacity-50"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 h-10 rounded-xl bg-lime-400 text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
          >
            Send
          </button>
        </div>
      </div>

      <BottomNav active="ai" onNavigate={handleNavigate} />

      {/* Pending-change navigation modal */}
      {pendingNav && (
        <>
          <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setPendingNav(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-sm w-full space-y-4">
              <p className="text-white font-semibold">Pending changes</p>
              <p className="text-zinc-400 text-sm">
                You have proposed changes that haven&apos;t been applied yet. Leave without applying?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setPendingNav(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400 text-black">Stay</button>
                <button onClick={confirmLeave} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-300">Leave</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
