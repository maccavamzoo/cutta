import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { complianceLog } from "@/lib/db/schema";

// POST — upsert today's compliance check-in
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { logDate: string; compliance: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.logDate || !body.compliance) {
    return NextResponse.json(
      { error: "logDate and compliance are required." },
      { status: 422 }
    );
  }

  const valid = ["yes", "mostly", "no"];
  if (!valid.includes(body.compliance)) {
    return NextResponse.json(
      { error: "compliance must be yes, mostly, or no." },
      { status: 422 }
    );
  }

  const [row] = await db
    .insert(complianceLog)
    .values({
      clerkUserId: userId,
      logDate:     body.logDate,
      compliance:  body.compliance,
      notes:       body.notes?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [complianceLog.clerkUserId, complianceLog.logDate],
      set: {
        compliance: body.compliance,
        notes:      body.notes?.trim() || null,
      },
    })
    .returning();

  return NextResponse.json({ entry: row }, { status: 201 });
}

// GET — fetch today's compliance entry
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const logDate = searchParams.get("logDate");
  if (!logDate) {
    return NextResponse.json({ error: "logDate query param required." }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(complianceLog)
    .where(
      and(
        eq(complianceLog.clerkUserId, userId),
        eq(complianceLog.logDate, logDate)
      )
    )
    .limit(1);

  return NextResponse.json({ entry: row ?? null });
}
