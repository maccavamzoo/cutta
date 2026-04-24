import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents, userProfiles } from "@/lib/db/schema";

// ─── Overlap detection ──────────────────────────────────────────────────────
// Returns the first same-user calendar_events row whose [start, end) window
// intersects the proposed [startAt, startAt + durationMinutes * 60_000) —
// using the strict rule start1 < end2 && start2 < end1 so back-to-back events
// (one ends exactly when the next starts) are not a conflict.
// Rows with null durationMinutes (rest events) are treated as non-blocking.
async function findConflictingEvent(
  clerkUserId: string,
  startAt: Date,
  durationMinutes: number,
  excludeId?: number,
): Promise<typeof calendarEvents.$inferSelect | null> {
  const start = startAt.getTime();
  const end   = start + durationMinutes * 60_000;

  // Max duration the UI allows is 600 min (10h), so ±24h around the proposed
  // window is enough to surface any row that could possibly intersect it.
  const DAY_MS      = 24 * 60 * 60 * 1000;
  const windowStart = new Date(start - DAY_MS);
  const windowEnd   = new Date(end   + DAY_MS);

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.clerkUserId, clerkUserId),
        gte(calendarEvents.scheduledAt, windowStart),
        lt(calendarEvents.scheduledAt,  windowEnd),
      )
    );

  for (const row of rows) {
    if (excludeId !== undefined && row.id === excludeId) continue;
    if (row.durationMinutes === null) continue;
    const rowStart = row.scheduledAt.getTime();
    const rowEnd   = rowStart + row.durationMinutes * 60_000;
    if (start < rowEnd && rowStart < end) return row;
  }
  return null;
}

async function getTimezoneForUser(clerkUserId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);
  return row?.timezone ?? "UTC";
}

function formatHM(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).format(date);
}

function conflictMessage(
  conflict: typeof calendarEvents.$inferSelect,
  timezone: string,
): string {
  const start = conflict.scheduledAt;
  const end   = new Date(start.getTime() + (conflict.durationMinutes ?? 0) * 60_000);
  return `Clashes with '${conflict.title}' (${formatHM(start, timezone)}–${formatHM(end, timezone)})`;
}

// PATCH — update an existing event by ID
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id: number;
    title?: string;
    eventType?: string;
    scheduledAt?: string;
    durationMinutes?: number | null;
    intensity?: string | null;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 422 });

  const [existing] = await db
    .select({
      clerkUserId:     calendarEvents.clerkUserId,
      scheduledAt:     calendarEvents.scheduledAt,
      durationMinutes: calendarEvents.durationMinutes,
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, body.id))
    .limit(1);

  if (!existing || existing.clerkUserId !== userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updates: Partial<typeof calendarEvents.$inferInsert> = {};
  if (body.title       !== undefined) updates.title           = body.title.trim();
  if (body.eventType   !== undefined) updates.eventType       = body.eventType;
  if (body.scheduledAt !== undefined) updates.scheduledAt     = new Date(body.scheduledAt);
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes ?? null;
  if (body.intensity   !== undefined) updates.intensity       = body.intensity ?? null;
  if (body.notes       !== undefined) updates.notes           = body.notes?.trim() || null;

  // Effective values after the patch, used for overlap detection.
  const effectiveScheduledAt = body.scheduledAt !== undefined
    ? new Date(body.scheduledAt)
    : existing.scheduledAt;
  const effectiveDuration = body.durationMinutes !== undefined
    ? (body.durationMinutes ?? null)
    : existing.durationMinutes;

  if (typeof effectiveDuration === "number") {
    const conflict = await findConflictingEvent(userId, effectiveScheduledAt, effectiveDuration, body.id);
    if (conflict) {
      const tz = await getTimezoneForUser(userId);
      return NextResponse.json({ error: conflictMessage(conflict, tz) }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(calendarEvents)
    .set(updates)
    .where(eq(calendarEvents.id, body.id))
    .returning();

  return NextResponse.json({ event: updated });
}

// DELETE — delete an event by ID (fuelling_plans.calendarEventId → set null via FK)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 422 });

  const [existing] = await db
    .select({ clerkUserId: calendarEvents.clerkUserId })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, body.id))
    .limit(1);

  if (!existing || existing.clerkUserId !== userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.delete(calendarEvents).where(eq(calendarEvents.id, body.id));

  return NextResponse.json({ ok: true });
}

// GET — fetch events within a date range (?from=ISO&to=ISO)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required" },
      { status: 400 }
    );
  }

  const events = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.clerkUserId, userId),
        gte(calendarEvents.scheduledAt, new Date(from)),
        lt(calendarEvents.scheduledAt, new Date(to))
      )
    )
    .orderBy(calendarEvents.scheduledAt);

  return NextResponse.json({ events });
}

// POST — create a new calendar event
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title: string;
    eventType: string;
    scheduledAt: string;
    durationMinutes?: number;
    intensity?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 422 });
  }

  if (!body.scheduledAt) {
    return NextResponse.json(
      { error: "scheduledAt is required." },
      { status: 422 }
    );
  }

  if (!body.eventType || typeof body.eventType !== "string" || body.eventType.trim().length === 0) {
    return NextResponse.json({ error: "eventType is required." }, { status: 422 });
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (typeof body.durationMinutes === "number") {
    const conflict = await findConflictingEvent(userId, scheduledAt, body.durationMinutes);
    if (conflict) {
      const tz = await getTimezoneForUser(userId);
      return NextResponse.json({ error: conflictMessage(conflict, tz) }, { status: 409 });
    }
  }

  const [created] = await db
    .insert(calendarEvents)
    .values({
      clerkUserId: userId,
      title: body.title.trim(),
      eventType: body.eventType.trim(),
      scheduledAt,
      durationMinutes: body.durationMinutes ?? null,
      notes: body.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json({ event: created }, { status: 201 });
}
