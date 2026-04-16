"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BottomNav from "@/components/BottomNav";

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
  isHolding?: boolean;
  timestamp?: number;
  responseTimeMs?: number;
}

interface ApiResponse {
  reply:                       string;
  systemPrompt:                string;
  proposedStrategyUpdate:      { ingredientPool: string[]; shoppingItems: unknown[] } | null;
  strategyValidationError:     string | null;
  proposedActivityType:        Record<string, unknown> | null;
  activityTypeValidationError: string | null;
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

export default function AdvisorView({ initialChatHistory = [], prefillMessage }: { initialChatHistory?: Message[]; prefillMessage?: string }) {
  const router = useRouter();

  const [messages,  setMessages]  = useState<Message[]>(initialChatHistory);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);

  // Strategy update flow
  const [pendingStrategy,  setPendingStrategy]  = useState<{ ingredientPool: string[]; shoppingItems: unknown[] } | null>(null);
  const [applyingStrategy, setApplyingStrategy] = useState(false);

  // Activity type proposal flow
  const [pendingActivityType,  setPendingActivityType]  = useState<Record<string, unknown> | null>(null);
  const [savingActivityType,   setSavingActivityType]   = useState(false);

  // Debug mode — cycles normal → inspect → live → normal
  const [debugMode, setDebugMode] = useState<"normal" | "inspect" | "live">("normal");
  const [inspectData, setInspectData] = useState<{ systemPrompt: string; userMessage: string } | null>(null);
  const [liveCallLog, setLiveCallLog] = useState<{ index: number; system: string; messages: { role: string; content: string }[] }[]>([]);
  const liveLogRef = useRef<HTMLDivElement>(null);
  const keyPressCountRef = useRef(0);
  const keyPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation guard
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const hasPending = pendingStrategy !== null || pendingActivityType !== null;

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

  // Prefill + auto-send from URL param (e.g. from activity types page)
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (!prefillMessage || prefillHandled.current) return;
    prefillHandled.current = true;
    // Clear any existing chat
    setMessages([]);
    setPendingStrategy(null);
    setPendingActivityType(null);
    void saveHistory([]);
    // Auto-send after a short delay to let state settle
    setTimeout(() => { sendMessage(prefillMessage); }, 100);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "`") return;
      keyPressCountRef.current += 1;
      if (keyPressTimerRef.current) clearTimeout(keyPressTimerRef.current);
      keyPressTimerRef.current = setTimeout(() => { keyPressCountRef.current = 0; }, 600);
      if (keyPressCountRef.current >= 3) {
        keyPressCountRef.current = 0;
        setDebugMode((prev) => prev === "normal" ? "inspect" : prev === "inspect" ? "live" : "normal");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight > el.clientHeight) {
        // live mode — the messages div is the scroller
        el.scrollTop = el.scrollHeight;
      } else {
        // normal mode — page scrolls
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  useEffect(() => {
    if (liveLogRef.current) {
      liveLogRef.current.scrollTop = liveLogRef.current.scrollHeight;
    }
  }, [liveCallLog]);

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
    setPendingStrategy(null);
    setPendingActivityType(null);
    await saveHistory([]);
  }

  // ── Send message ────────────────────────────────────────────────────────

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    if (debugMode === "inspect") {
      setLoading(true);
      setInput("");
      try {
        const res = await fetch("/api/advisor/inspect-prompt", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message: text, conversationHistory: messages }),
        });
        if (res.ok) {
          const data = await res.json() as { systemPrompt: string; userMessage: string };
          setInspectData(data);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Two-step flow (+ parallel inspect-prompt fetch in live mode)
    const startTime = Date.now();
    const historyForApi = messages.filter((m) => !m.isHolding);


    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      // Step 1 — holding message + data manifest
      const step1Res = await fetch("/api/advisor/chat/step1", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, conversationHistory: historyForApi }),
      });

      let holdingMessage = "Bear with me…";
      let requestedData: string[] = ["Profile", "Protocol", "Calendar", "Feedback", "Weight", "Shopping"];

      if (step1Res.ok) {
        const step1Data = await step1Res.json() as { holdingMessage: string; requestedData: string[]; step1SystemPrompt: string };
        holdingMessage = step1Data.holdingMessage;
        requestedData  = step1Data.requestedData;
        if (debugMode === "live") {
          const step1Messages = [...historyForApi, { role: "user", content: text }];
          setLiveCallLog((prev) => [...prev, { index: prev.length + 1, system: step1Data.step1SystemPrompt, messages: step1Messages }]);
        }
      }

      // No data needed — holdingMessage is the final answer
      if (requestedData.length === 0) {
        const finalMsg: Message = { role: "assistant", content: holdingMessage, timestamp: Date.now(), responseTimeMs: Date.now() - startTime };
        setMessages((prev) => [...prev, finalMsg]);
        void saveHistory([...historyForApi, { role: "user", content: text }, finalMsg]);
        return;
      }

      // Append holding bubble
      setMessages((prev) => [...prev, { role: "assistant", content: holdingMessage, isHolding: true, timestamp: Date.now() }]);

      // Step 2 — fetch data + real answer
      const step2Res = await fetch("/api/advisor/chat/step2", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, conversationHistory: historyForApi, requestedData }),
      });

      const step2Data = await step2Res.json() as ApiResponse;

      if (!step2Res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: (step2Data as { error?: string }).error ?? "Something went wrong. Please try again." }]);
        return;
      }

      const realMsg: Message = { role: "assistant", content: step2Data.reply, timestamp: Date.now(), responseTimeMs: Date.now() - startTime };
      setMessages((prev) => [...prev, realMsg]);

      if (debugMode === "live") {
        const step2Messages = [...historyForApi, { role: "user", content: text }];
        setLiveCallLog((prev) => [...prev, { index: prev.length + 1, system: step2Data.systemPrompt, messages: step2Messages }]);
      }

      void saveHistory([...historyForApi, { role: "user", content: text }, { role: "assistant", content: holdingMessage, isHolding: true }, realMsg]);

      if (step2Data.proposedStrategyUpdate) {
        setPendingStrategy(step2Data.proposedStrategyUpdate);
      }
      if (step2Data.strategyValidationError) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Note: shopping update couldn't be validated — ${step2Data.strategyValidationError}` }]);
      }
      if (step2Data.proposedActivityType) {
        setPendingActivityType(step2Data.proposedActivityType);
      }
      if (step2Data.activityTypeValidationError) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Note: activity type couldn't be validated — ${step2Data.activityTypeValidationError}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() { sendMessage(); }

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

  // ── Activity type proposal flow ────────────────────────────────────────

  async function handleApplyActivityType() {
    if (!pendingActivityType) return;
    setSavingActivityType(true);
    try {
      // Transform flat snake_case AI output to the nested camelCase shape the API expects
      const body = {
        name:                  pendingActivityType.name,
        description:           pendingActivityType.description ?? "",
        burnRateKcalPerMin:    pendingActivityType.burn_rate_kcal_per_min,
        carbsGPerKg:           pendingActivityType.carbs_g_per_kg,
        proteinGPerKg:         pendingActivityType.protein_g_per_kg,
        preActivity: {
          timing_hours_before: pendingActivityType.pre_timing_hours_before ?? 2,
          focus:               pendingActivityType.pre_focus ?? "Moderate carbs, low fibre",
        },
        duringActivity: pendingActivityType.during_carbs_per_hour != null
          ? { carbs_per_hour: pendingActivityType.during_carbs_per_hour, description: pendingActivityType.during_description ?? "Drink mix or gels" }
          : null,
        postActivity: {
          timing_minutes_after: pendingActivityType.post_timing_minutes_after ?? 30,
          focus:                pendingActivityType.post_focus ?? "Protein and carbs for recovery",
          protein_g_per_kg:     pendingActivityType.post_protein_g_per_kg ?? 0.3,
          carbs_g_per_kg:       pendingActivityType.post_carbs_g_per_kg ?? 0.8,
        },
        defaultDurationMinutes: pendingActivityType.default_duration_minutes ?? 60,
        isRace:                 pendingActivityType.is_race ?? false,
      };

      const res = await fetch("/api/activity-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setPendingActivityType(null);
        const name = String(pendingActivityType.name ?? "Activity type");
        setMessages((prev) => [...prev, { role: "assistant", content: `"${name}" has been saved to your activity types.` }]);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: `Failed to save: ${(data as { error?: string }).error ?? "unknown error"}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error while saving activity type." }]);
    } finally {
      setSavingActivityType(false);
    }
  }

  function handleRejectActivityType() {
    setPendingActivityType(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "Activity type discarded." }]);
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
      <div>

        {/* Left panel — live prompt inspector */}
        {debugMode === "live" && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "420px", height: "100vh", zIndex: 50, overflow: "hidden", display: "flex", flexDirection: "column" }} className="border-r border-zinc-800 bg-zinc-950">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 shrink-0">
              <span className="text-white text-sm font-semibold">Live Prompt</span>
              <span className="bg-lime-400/10 text-lime-400 border border-lime-400/30 text-xs px-2 py-0.5 rounded-full">Live</span>
            </div>
            {liveCallLog.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-zinc-700 text-xs">Send a message to see the prompt</p>
              </div>
            ) : (
              <div ref={liveLogRef} className="flex-1 overflow-y-auto overflow-x-hidden">
                {liveCallLog.map((call, i) => (
                  <div key={call.index} className={i > 0 ? "border-t border-zinc-800" : ""}>
                    <p className="text-zinc-500 text-xs font-mono px-3 py-2 shrink-0">── CALL {call.index} {"─".repeat(20)}</p>
                    <div className="px-3 pb-1">
                      <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">System</p>
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%" }} className="text-xs text-zinc-300 font-mono">{call.system}</pre>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Messages</p>
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%" }} className="text-xs text-zinc-300 font-mono">{JSON.stringify(call.messages, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right panel — normal chat */}
        <div style={debugMode === "live" ? { marginLeft: "420px" } : undefined}>

      {/* Header — sticky so it stays visible while messages scroll */}
      <div className="sticky top-0 z-30 bg-black px-4 pt-5 pb-3 border-b border-zinc-800">
        <div className="max-w-lg mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Cutta AI</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Nutrition, training &amp; protocol advice</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {debugMode === "inspect" && (
              <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-xs px-2 py-0.5 rounded-full">Inspect</span>
            )}
            {debugMode === "live" && (
              <span className="bg-lime-400/10 text-lime-400 border border-lime-400/30 text-xs px-2 py-0.5 rounded-full">Live Debug</span>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>
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
                  {msg.role === "assistant" && !msg.isHolding && msg.timestamp && (
                    <p className="text-zinc-600 text-xs mb-1.5">
                      {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(msg.timestamp))}
                      {msg.responseTimeMs != null && ` · ${(msg.responseTimeMs / 1000).toFixed(1)}s`}
                    </p>
                  )}
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className={`markdown-content leading-relaxed${msg.isHolding ? " opacity-70 italic" : ""}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,
                          h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-100 mt-2.5 mb-1 first:mt-0">{children}</h3>,
                          ul: ({ children }) => <ul className="space-y-1 my-2 pl-4">{children}</ul>,
                          ol: ({ children }) => <ol className="space-y-1 my-2 pl-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="text-zinc-200 leading-relaxed relative before:content-['•'] before:text-lime-400 before:absolute before:-left-3">{children}</li>,
                          code: ({ children, className }) => {
                            const isInline = !className;
                            return isInline
                              ? <code className="bg-zinc-900 text-lime-400 px-1 py-0.5 rounded text-xs">{children}</code>
                              : <code className="block bg-zinc-900 text-zinc-100 p-3 rounded-lg my-2 text-xs font-mono whitespace-pre overflow-x-auto">{children}</code>;
                          },
                          pre: ({ children }) => <pre className="my-2">{children}</pre>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>,
                          hr: () => <hr className="border-zinc-700 my-3" />,
                          a: ({ children, href }) => <a href={href} className="text-lime-400 hover:text-lime-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                          table: ({ children }) => <table className="my-2 border-collapse text-xs">{children}</table>,
                          th: ({ children }) => <th className="border border-zinc-700 px-2 py-1 bg-zinc-900 text-left">{children}</th>,
                          td: ({ children }) => <td className="border border-zinc-700 px-2 py-1">{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

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

            {/* Activity type proposal card */}
            {pendingActivityType && (
              <div className="rounded-xl border border-lime-400/30 bg-zinc-800/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" />
                  <p className="text-zinc-200 text-sm font-semibold">
                    New activity type: {String(pendingActivityType.name ?? "Unnamed")}
                  </p>
                </div>
                <div className="text-zinc-400 text-xs space-y-0.5">
                  {!!pendingActivityType.description && (
                    <p>{String(pendingActivityType.description)}</p>
                  )}
                  <p>Burn rate: {String(pendingActivityType.burn_rate_kcal_per_min)} kcal/min</p>
                  <p>Carbs: {String(pendingActivityType.carbs_g_per_kg)} g/kg &middot; Protein: {String(pendingActivityType.protein_g_per_kg)} g/kg</p>
                  {pendingActivityType.during_carbs_per_hour != null && (
                    <p>During: {String(pendingActivityType.during_carbs_per_hour)}g carbs/hr</p>
                  )}
                  <p>Duration: {String(pendingActivityType.default_duration_minutes)} min</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyActivityType}
                    disabled={savingActivityType}
                    className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold disabled:opacity-50"
                  >
                    {savingActivityType ? "Saving\u2026" : "Save activity type"}
                  </button>
                  <button
                    onClick={handleRejectActivityType}
                    disabled={savingActivityType}
                    className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {loading && <LoadingDots />}
          </div>
        </div>

      {/* Input bar — fixed above BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 bg-black z-30" style={{ boxShadow: "0 -1px 0 0 rgb(39 39 42)" }}>
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

        </div>{/* end right panel */}
      </div>{/* end flex wrapper */}

      {/* Prompt Inspector modal */}
      {inspectData !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">Prompt Inspector</span>
              <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-xs px-2 py-0.5 rounded-full">Debug mode</span>
            </div>
            <button
              onClick={() => setInspectData(null)}
              className="text-zinc-400 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden border-b border-zinc-800/60">
              <p className="text-xs text-zinc-500 uppercase tracking-wider px-4 pt-3 pb-1 shrink-0">System Prompt</p>
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono px-4 py-2 overflow-y-auto flex-1">
                {inspectData.systemPrompt}
              </pre>
            </div>
            <div className="flex flex-col" style={{ maxHeight: "8rem" }}>
              <p className="text-xs text-zinc-500 uppercase tracking-wider px-4 pt-3 pb-1 shrink-0">User Message</p>
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono px-4 py-2 overflow-y-auto" style={{ maxHeight: "6rem" }}>
                {inspectData.userMessage}
              </pre>
            </div>
          </div>
        </div>
      )}

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
