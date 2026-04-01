"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        {(["protocol", "advisor"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 pb-3 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "text-lime-400 border-b-2 border-lime-400 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "protocol" ? "Protocol" : "Tweak with AI"}
          </button>
        ))}
      </div>

      {/* ── Protocol tab ───────────────────────────────────────────── */}
      {tab === "protocol" && (
        <div className="space-y-6">
          {/* Template picker */}
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

      {/* ── Advisor tab ────────────────────────────────────────────── */}
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
            />
          )}
        </div>
      )}
    </div>
  );
}
