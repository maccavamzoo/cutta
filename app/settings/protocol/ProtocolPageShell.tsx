"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TemplatePicker from "./TemplatePicker";
import ProtocolUpload from "./ProtocolUpload";

export default function ProtocolPageShell({
  activeProtocolName,
  hasActiveProtocol,
}: {
  activeProtocolName: string | null;
  hasActiveProtocol: boolean;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Template picker */}
      <section className="space-y-3">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Choose a template
        </p>
        <TemplatePicker
          activeProtocolName={activeProtocolName}
          onActivated={() => router.refresh()}
        />
      </section>

      {/* Collapsible custom upload */}
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

        {/* Smooth height animation via CSS grid rows */}
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
    </div>
  );
}
