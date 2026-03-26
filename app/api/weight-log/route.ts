import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, userProfiles } from "@/lib/db/schema";

// POST /api/weight-log — save a weigh-in entry and update profile current weight
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

  await db.insert(weightLog).values({
    clerkUserId: userId,
    weightKg:    weightKg.toFixed(1),
    bodyFatPct:  bodyFatPct !== null ? bodyFatPct.toFixed(1) : null,
  });

  // Keep profile current weight in sync
  await db
    .update(userProfiles)
    .set({ currentWeightKg: weightKg.toFixed(1), updatedAt: new Date() })
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
