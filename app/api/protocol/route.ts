import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { validateProtocol } from "@/lib/protocol";

// GET — return the current user's active protocol
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [active] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
    .limit(1);

  return NextResponse.json({ protocol: active ?? null });
}

// POST — validate, deactivate old protocols, save new one as active
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Extract saveAsTemplate flag before validation so it doesn't end up in protocol content
  const saveAsTemplate = rawBody.saveAsTemplate === true;
  const protocolData: Record<string, unknown> = { ...rawBody };
  delete protocolData.saveAsTemplate;

  const result = validateProtocol(protocolData);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Deactivate all existing protocols for this user
  await db
    .update(protocols)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(protocols.clerkUserId, userId));

  // Insert new protocol as active
  const [created] = await db
    .insert(protocols)
    .values({
      clerkUserId: userId,
      name: result.data.protocol_name,
      content: result.data,
      isActive: true,
      isTemplate: saveAsTemplate,
    })
    .returning();

  return NextResponse.json({ protocol: created }, { status: 201 });
}

// PATCH — set is_template = true on the active protocol ("save to my templates")
export async function PATCH() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [active] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
    .limit(1);

  if (!active) {
    return NextResponse.json({ error: "No active protocol." }, { status: 400 });
  }

  await db
    .update(protocols)
    .set({ isTemplate: true, updatedAt: new Date() })
    .where(eq(protocols.id, active.id));

  return NextResponse.json({ ok: true });
}
