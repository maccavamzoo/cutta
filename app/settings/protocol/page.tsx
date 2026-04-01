import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { ProtocolFile } from "@/lib/protocol";
import ProtocolPageShell from "./ProtocolPageShell";
import ProtocolReadable from "./ProtocolReadable";
import ProtocolChat from "./ProtocolChat";

export default async function ProtocolSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [active] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
    .limit(1);

  const content = active?.content as ProtocolFile | undefined;

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto space-y-8">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
      >
        ← Back
      </Link>

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

      {/* Template picker + upload */}
      <ProtocolPageShell
        activeProtocolName={content?.protocol_name ?? null}
        hasActiveProtocol={!!active}
      />

      {/* Active protocol detail */}
      {active && content && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Active protocol
          </p>
          <ProtocolReadable
            protocol={content}
            activatedAt={new Date(active.createdAt)}
          />
        </section>
      )}

      {/* Protocol Q&A chat */}
      {active && <ProtocolChat hasProtocol={true} />}
    </main>
  );
}
