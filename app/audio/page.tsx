import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioNotes } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import RecordView from "./RecordView";

export default async function AudioNotesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [recentNotes, countResult] = await Promise.all([
    db
      .select()
      .from(audioNotes)
      .where(eq(audioNotes.clerkUserId, userId))
      .orderBy(desc(audioNotes.recordedAt))
      .limit(20),
    db
      .select({ total: count() })
      .from(audioNotes)
      .where(eq(audioNotes.clerkUserId, userId)),
  ]);

  const totalNoteCount = countResult[0]?.total ?? 0;

  const initialNotes = recentNotes.map((n) => ({
    id:               n.id,
    transcript:       n.transcript,
    processedData:    n.processedData as Record<string, unknown> | null,
    processingStatus: n.processingStatus,
    recordedAt:       n.recordedAt.toISOString(),
  }));

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Audio notes</h1>
              {totalNoteCount > 0 && (
                <span className="text-zinc-600 text-sm tabular-nums">{totalNoteCount}</span>
              )}
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              Record voice memos — energy levels, gut feelings, food reactions.
            </p>
          </div>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <RecordView initialNotes={initialNotes as any} totalNoteCount={totalNoteCount} />
        </div>
      </main>

      <BottomNav active="more" />
    </>
  );
}
