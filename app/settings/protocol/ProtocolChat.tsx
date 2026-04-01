"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ProtocolFile } from "@/lib/protocol";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  hasProtocol: boolean;
  activeProtocolName: string;
  /** When false, render the chat body directly without a collapse wrapper (used in Advisor tab) */
  collapsible?: boolean;
}

export default function ProtocolChat({
  hasProtocol,
  activeProtocolName,
  collapsible = true,
}: Props) {
  const router = useRouter();

  // Collapse state — only used when collapsible=true
  const [open, setOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Pending update flow
  const [pendingUpdate, setPendingUpdate] = useState<ProtocolFile | null>(null);

  // Naming card state (shown instead of Apply/Reject buttons)
  const [showNamingCard, setShowNamingCard] = useState(false);
  const [proposedName, setProposedName]     = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [saving, setSaving]                 = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages / loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingUpdate, showNamingCard]);

  // Focus input when panel opens (collapsible mode)
  useEffect(() => {
    if (open && collapsible) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, collapsible]);

  // Focus input immediately when non-collapsible
  useEffect(() => {
    if (!collapsible) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [collapsible]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev: Message[]) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/protocol/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.map((m: Message) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev: Message[]) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Something went wrong. Please try again." },
        ]);
        return;
      }

      setMessages((prev: Message[]) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.proposedUpdate) {
        setPendingUpdate(data.proposedUpdate);
        setShowNamingCard(false);
        setProposedName(`${activeProtocolName} (modified)`);
        setSaveAsTemplate(true);
      }

      if (data.validationError) {
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: "assistant",
            content: `Note: The proposed change couldn't be validated — ${data.validationError}`,
          },
        ]);
      }
    } catch {
      setMessages((prev: Message[]) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Show the naming card instead of immediately saving
  function handleApplyClick() {
    setProposedName(`${activeProtocolName} (modified)`);
    setSaveAsTemplate(true);
    setShowNamingCard(true);
  }

  async function handleConfirmSave() {
    if (!pendingUpdate || !proposedName.trim()) return;
    setSaving(true);

    const payload = {
      ...pendingUpdate,
      protocol_name: proposedName.trim(),
      saveAsTemplate,
    };

    try {
      const res = await fetch("/api/protocol", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPendingUpdate(null);
        setShowNamingCard(false);
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: "assistant",
            content: `Protocol saved as "${proposedName.trim()}".${saveAsTemplate ? " Added to your templates." : ""} Your plan will use the new rules next time it generates.`,
          },
        ]);
        router.refresh();
      } else {
        const data = await res.json();
        setMessages((prev: Message[]) => [
          ...prev,
          { role: "assistant", content: `Failed to save: ${data.error ?? "unknown error"}` },
        ]);
        setShowNamingCard(false);
      }
    } catch {
      setMessages((prev: Message[]) => [
        ...prev,
        { role: "assistant", content: "Network error while saving." },
      ]);
      setShowNamingCard(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelNaming() {
    setShowNamingCard(false);
  }

  function handleRejectUpdate() {
    setPendingUpdate(null);
    setShowNamingCard(false);
    setMessages((prev: Message[]) => [
      ...prev,
      { role: "assistant", content: "Change rejected — protocol unchanged." },
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!hasProtocol) return null;

  const chatBody = (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-4">
            Ask anything — what your protocol means, how to adjust macros, what to change for a race week…
          </p>
        )}

        {messages.map((msg: Message, i: number) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-lime-400/10 border border-lime-400/20 text-zinc-100 rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Pending update card */}
        {pendingUpdate && !showNamingCard && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0" />
              <p className="text-zinc-200 text-sm font-semibold">Protocol update proposed</p>
            </div>
            <p className="text-zinc-400 text-xs">
              Applying will replace your current active protocol.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApplyClick}
                className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold"
              >
                Apply changes
              </button>
              <button
                onClick={handleRejectUpdate}
                className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Naming card */}
        {pendingUpdate && showNamingCard && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 space-y-3">
            <p className="text-zinc-200 text-sm font-semibold">Name this protocol</p>

            <input
              type="text"
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder="Protocol name…"
              className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-500"
            />

            {/* Save as template toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setSaveAsTemplate((v: boolean) => !v)}
                className={`w-9 h-5 rounded-full relative transition-colors ${
                  saveAsTemplate ? "bg-lime-400" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                    saveAsTemplate ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-zinc-300 text-sm">Save to my templates</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleConfirmSave}
                disabled={saving || !proposedName.trim()}
                className="flex-1 py-2 rounded-lg bg-lime-400 text-black text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancelNaming}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask a question or request a change…"
          className="flex-1 bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-lime-400 text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );

  // Non-collapsible: render chat body directly (used in Advisor tab)
  if (!collapsible) {
    return chatBody;
  }

  // Collapsible mode (legacy, kept for potential reuse)
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v: boolean) => !v)}
        className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors w-full"
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v6A1.5 1.5 0 0112.5 11H9l-3 3v-3H3.5A1.5 1.5 0 012 9.5v-6z" />
        </svg>
        Ask about your protocol
        <svg
          className={`w-3.5 h-3.5 ml-auto transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          {chatBody}
        </div>
      </div>
    </section>
  );
}
