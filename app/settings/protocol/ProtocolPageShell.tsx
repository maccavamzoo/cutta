"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import TemplatePicker from "./TemplatePicker";
import type { ProtocolFile } from "@/lib/protocol";

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
  children?: React.ReactNode;
}

export default function ProtocolPageShell({
  activeProtocolName,
  hasActiveProtocol,
  savedTemplates,
  children,
}: Props) {
  const router = useRouter();

  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Template picker */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Choose a protocol
          </p>
          <TemplatePicker
            activeProtocolName={activeProtocolName}
            savedTemplates={savedTemplates}
            onActivated={() => router.refresh()}
            onDeleted={() => router.refresh()}
          />
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

        {/* Link to unified AI advisor */}
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
