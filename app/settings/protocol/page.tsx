import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { ProtocolFile } from "@/lib/protocol";
import ProtocolPageShell from "./ProtocolPageShell";
import ProtocolReadable from "./ProtocolReadable";

export default async function ProtocolSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Active protocol + saved templates in parallel
  const [activeRows, templateRows] = await Promise.all([
    db
      .select()
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
    db
      .select()
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isTemplate, true))),
  ]);

  const active  = activeRows[0];
  const content = active?.content as ProtocolFile | undefined;

  const savedTemplates = templateRows.map((p: typeof templateRows[0]) => ({
    id: p.id,
    name: p.name,
    content: p.content as ProtocolFile,
  }));

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Protocol</h1>
          {content && (
            <span className="px-2.5 py-0.5 rounded-full bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-semibold">
              {content.protocol_name}
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-sm">
          Your fuelling rulebook. The AI follows this when building your plan.
        </p>
      </div>

      {/* Tab shell — back link, tabs, BottomNav, and modal all live inside the client shell */}
      <ProtocolPageShell
        activeProtocolName={content?.protocol_name ?? null}
        hasActiveProtocol={!!active}
        activeIsTemplate={active?.isTemplate ?? false}
        savedTemplates={savedTemplates}
      >
        {active && content && (
          <ProtocolReadable
            protocol={content}
            activatedAt={new Date(active.createdAt)}
            isTemplate={active.isTemplate}
          />
        )}
      </ProtocolPageShell>
    </main>
  );
}
