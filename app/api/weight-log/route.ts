import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, userProfiles } from "@/lib/db/schema";
import { getUserToday } from "@/lib/dates";

// POST /api/weight-log — upsert today's weigh-in (one entry per user per day)
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const weightKg   = typeof body.weightKg   === "number" ? body.weightKg   : null;
  const bodyFatPct = typeof body.bodyFatPct === "number" ? body.bodyFatPct : null;

  if (!weightKg || weightKg < 20 || weightKg > 400) {
    return NextResponse.json({ error: "Invalid weight value." }, { status: 400 });
  }
  if (bodyFatPct !== null && (bodyFatPct < 1 || bodyFatPct > 70)) {
    return NextResponse.json({ error: "Invalid body fat percentage." }, { status: 400 });
  }

  // Use the user's timezone to determine the correct local date
  const [profileRow] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const { todayStr } = getUserToday(profileRow?.timezone ?? null);
  const now = new Date();

  // Upsert: one row per user per day
  await db
    .insert(weightLog)
    .values({
      clerkUserId: userId,
      logDate:     todayStr,
      weighedAt:   now,
      weightKg:    weightKg.toFixed(1),
      bodyFatPct:  bodyFatPct !== null ? bodyFatPct.toFixed(1) : null,
    })
    .onConflictDoUpdate({
      target: [weightLog.clerkUserId, weightLog.logDate],
      set: {
        weighedAt:  now,
        weightKg:   weightKg.toFixed(1),
        bodyFatPct: bodyFatPct !== null ? bodyFatPct.toFixed(1) : null,
      },
    });

  // Keep profile current weight in sync
  await db
    .update(userProfiles)
    .set({ currentWeightKg: weightKg.toFixed(1), updatedAt: now })
    .where(eq(userProfiles.clerkUserId, userId));

  return NextResponse.json({ ok: true });
}

// GET /api/weight-log — fetch the most recent entry
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await db
    .select()
    .from(weightLog)
    .where(eq(weightLog.clerkUserId, userId))
    .orderBy(desc(weightLog.weighedAt))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}
