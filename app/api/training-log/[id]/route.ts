import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { trainingLog } from "@/lib/db/schema";

// PATCH — update perceived effort on a saved training log entry
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  let perceivedEffort: string;
  try {
    const body = await req.json();
    perceivedEffort = body.perceivedEffort;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!perceivedEffort || typeof perceivedEffort !== "string") {
    return NextResponse.json({ error: "perceivedEffort is required." }, { status: 422 });
  }

  const [updated] = await db
    .update(trainingLog)
    .set({ perceivedEffort })
    .where(and(eq(trainingLog.id, id), eq(trainingLog.clerkUserId, userId)))
    .returning({ id: trainingLog.id });

  if (!updated) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
