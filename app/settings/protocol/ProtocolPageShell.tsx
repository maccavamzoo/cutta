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
          onClick={() => setUploadOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors"
        >
          <span className="text-base leading-none">{uploadOpen ? "−" : "+"}</span>
          Or upload custom JSON
        </button>

        {uploadOpen && (
          <div className="space-y-3">
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
        )}
      </section>
    </div>
  );
}
