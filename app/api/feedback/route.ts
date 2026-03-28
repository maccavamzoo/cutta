import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbackLog } from "@/lib/db/schema";

const VALID_TYPES = ["ride_energy", "gut_comfort", "hunger", "stool_health"] as const;
type FeedbackType = (typeof VALID_TYPES)[number];

interface FeedbackEntry {
  feedbackType: FeedbackType;
  rating: number;
  notes?: string;
}

// POST — save one or more feedback signals for a date
// Body: { planDate: string; feedbacks: FeedbackEntry[] }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { planDate: string; feedbacks: FeedbackEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.planDate || !Array.isArray(body.feedbacks) || body.feedbacks.length === 0) {
    return NextResponse.json(
      { error: "planDate and a non-empty feedbacks array are required." },
      { status: 422 }
    );
  }

  for (const f of body.feedbacks) {
    if (!VALID_TYPES.includes(f.feedbackType)) {
      return NextResponse.json(
        { error: `feedbackType must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 422 }
      );
    }
    if (typeof f.rating !== "number" || f.rating < 1 || f.rating > 5) {
      return NextResponse.json(
        { error: "Each rating must be an integer from 1 to 5." },
        { status: 422 }
      );
    }
  }

  const now = new Date();

  // Upsert per (userId, planDate, feedbackType) to avoid duplicate signals
  const saved = [];
  for (const f of body.feedbacks) {
    // Delete existing entry for this type/date before inserting the new one
    await db
      .delete(feedbackLog)
      .where(
        and(
          eq(feedbackLog.clerkUserId, userId),
          eq(feedbackLog.planDate, body.planDate),
          eq(feedbackLog.feedbackType, f.feedbackType)
        )
      );

    const [row] = await db
      .insert(feedbackLog)
      .values({
        clerkUserId:  userId,
        planDate:     body.planDate,
        feedbackType: f.feedbackType,
        rating:       f.rating,
        notes:        f.notes?.trim() || null,
        loggedAt:     now,
      })
      .returning();

    saved.push(row);
  }

  return NextResponse.json({ saved: saved.length, entries: saved }, { status: 201 });
}

// GET — fetch feedback for a date (?planDate=YYYY-MM-DD)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const planDate = searchParams.get("planDate");
  if (!planDate) {
    return NextResponse.json({ error: "planDate query param required." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(feedbackLog)
    .where(
      and(
        eq(feedbackLog.clerkUserId, userId),
        eq(feedbackLog.planDate, planDate),
        inArray(feedbackLog.feedbackType, [...VALID_TYPES])
      )
    )
    .orderBy(feedbackLog.loggedAt);

  return NextResponse.json({ feedbacks: rows });
}
