import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";

// DELETE — remove a saved template
// If the protocol is still active: clear is_template flag, keep the row
// If not active: delete the row entirely
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const [proto] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.id, id)))
    .limit(1);

  if (!proto) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (proto.isActive) {
    // Keep the row (it's the active protocol) — just clear the template flag
    await db
      .update(protocols)
      .set({ isTemplate: false, updatedAt: new Date() })
      .where(eq(protocols.id, id));
  } else {
    // Not active — safe to delete entirely
    await db.delete(protocols).where(eq(protocols.id, id));
  }

  return NextResponse.json({ ok: true });
}
