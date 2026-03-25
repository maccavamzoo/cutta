import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";

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

  const validTypes = ["ride", "race", "rest", "other"];
  if (!validTypes.includes(body.eventType)) {
    return NextResponse.json(
      { error: "eventType must be ride, race, rest, or other." },
      { status: 422 }
    );
  }

  const [created] = await db
    .insert(calendarEvents)
    .values({
      clerkUserId: userId,
      title: body.title.trim(),
      eventType: body.eventType,
      scheduledAt: new Date(body.scheduledAt),
      durationMinutes: body.durationMinutes ?? null,
      intensity: body.intensity ?? null,
      notes: body.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json({ event: created }, { status: 201 });
}
