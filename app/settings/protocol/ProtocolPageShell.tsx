"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import TemplatePicker from "./TemplatePicker";
import ProtocolUpload from "./ProtocolUpload";
import ProtocolChat from "./ProtocolChat";
import type { ProtocolFile } from "@/lib/protocol";

type Tab = "protocol" | "advisor";

export interface SavedTemplate {
  id: number;
  name: string;
  content: ProtocolFile;
}

interface Props {
  activeProtocolName: string | null;
  hasActiveProtocol: boolean;
  activeIsTemplate: boolean;
  savedTemplates: SavedTemplate[];
  /** ProtocolReadable rendered by the server — passed as a child slot */
  children?: React.ReactNode;
}

export default function ProtocolPageShell({
  activeProtocolName,
  hasActiveProtocol,
  savedTemplates,
  children,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("protocol");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Unsaved-changes guard
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  /** Returns true (allow navigation) or false (block + show modal) */
  function handleNavigate(href: string): boolean {
    if (hasPendingUpdate) {
      setPendingNavigation(href);
      return false;
    }
    return true;
  }

  function handleBackClick() {
    if (hasPendingUpdate) {
      setPendingNavigation("/");
    } else {
      router.push("/");
    }
  }

  function confirmLeave() {
    if (pendingNavigation) router.push(pendingNavigation);
    setPendingNavigation(null);
  }

  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Back link */}
        <button
          type="button"
          onClick={handleBackClick}
          className="inline-flex items-center gap-1 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
        >
          ← Back
        </button>

        {/* Tab bar */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
          {/* Protocol — plain underline tab */}
          <button
            type="button"
            onClick={() => setTab("protocol")}
            className={`text-sm font-semibold transition-colors pb-0 ${
              tab === "protocol"
                ? "text-lime-400 border-b-2 border-lime-400 -mb-3 pb-3"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Protocol
          </button>

          {/* Tweak with AI — pill style */}
          <button
            type="button"
            onClick={() => setTab("advisor")}
            className={`transition-colors rounded-full px-4 py-1.5 text-sm font-medium border ${
              tab === "advisor"
                ? "bg-sky-500/25 text-sky-400 border-sky-400/50"
                : "bg-sky-500/15 text-sky-400 border-sky-400/30 hover:bg-sky-500/25"
            }`}
          >
            ✨ Tweak with AI
          </button>
        </div>

        {/* ── Protocol tab ─────────────────────────────────────────── */}
        {tab === "protocol" && (
          <div className="space-y-6">
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Choose a template
              </p>
              <TemplatePicker
                activeProtocolName={activeProtocolName}
                savedTemplates={savedTemplates}
                onActivated={refresh}
                onDeleted={refresh}
              />
            </section>

            {/* Collapsible JSON upload */}
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setUploadOpen((v: boolean) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors"
              >
                Or upload custom JSON
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${uploadOpen ? "rotate-180" : "rotate-0"}`}
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
                className={`grid transition-all duration-200 ease-in-out ${
                  uploadOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 pt-1">
                    <p className="text-zinc-600 text-xs">
                      Must be a <code className="text-zinc-400">.json</code> file with at
                      least a <code className="text-zinc-400">protocol_name</code> field.
                    </p>
                    {hasActiveProtocol && (
                      <p className="text-zinc-600 text-xs">
                        Uploading a new protocol will deactivate the current one.
                      </p>
                    )}
                    <ProtocolUpload hasActiveProtocol={hasActiveProtocol} />
                  </div>
                </div>
              </div>
            </section>

            {/* Active protocol readable — server-rendered slot */}
            {hasActiveProtocol && children && (
              <section className="space-y-3">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Active protocol
                </p>
                {children}
              </section>
            )}
          </div>
        )}

        {/* ── Tweak with AI tab ────────────────────────────────────── */}
        {tab === "advisor" && (
          <div className="space-y-4">
            {activeProtocolName ? (
              <p className="text-zinc-500 text-xs">Active: {activeProtocolName}</p>
            ) : (
              <p className="text-zinc-500 text-sm">
                No active protocol. Select or upload one on the Protocol tab first.
              </p>
            )}
            {hasActiveProtocol && (
              <ProtocolChat
                hasProtocol={true}
                activeProtocolName={activeProtocolName ?? ""}
                collapsible={false}
                onPendingChange={setHasPendingUpdate}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav active="settings" onNavigate={handleNavigate} />

      {/* Pending-change navigation modal */}
      {pendingNavigation && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setPendingNavigation(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-sm w-full space-y-4">
              <p className="text-white font-semibold">Pending protocol change</p>
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
