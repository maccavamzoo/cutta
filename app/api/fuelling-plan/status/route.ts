import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  fuellingPlans,
  userProfiles,
  protocols,
  calendarEvents,
  weightLog,
} from "@/lib/db/schema";

// GET /api/fuelling-plan/status
// Returns { stale: boolean } — true when the 3-day plan exists but data has changed since it was generated.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ stale: false });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr   = today.toISOString().split("T")[0];
  const day2 = new Date(today.getTime() + 2 * 86_400_000);
  const day2Str    = day2.toISOString().split("T")[0];
  // Calendar window: look 7 days ahead for event changes
  const day7 = new Date(today.getTime() + 7 * 86_400_000);

  const [planRows, profileRows, protocolRows, eventRows, weightRows] = await Promise.all([
    // Existing plans in the 3-day window
    db
      .select({ generatedAt: fuellingPlans.generatedAt })
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          gte(fuellingPlans.planDate, todayStr),
          lte(fuellingPlans.planDate, day2Str)
        )
      ),

    db
      .select({ updatedAt: userProfiles.updatedAt })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ updatedAt: protocols.updatedAt })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),

    db
      .select({ updatedAt: calendarEvents.updatedAt })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, today),
          lte(calendarEvents.scheduledAt, day7)
        )
      ),

    db
      .select({ weighedAt: weightLog.weighedAt })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.weighedAt))
      .limit(1),
  ]);

  // No plan yet — not stale, just empty
  if (planRows.length === 0) {
    return NextResponse.json({ stale: false });
  }

  // Use the earliest generatedAt so any plan in the window that's behind a change triggers the bar
  const minGeneratedAt = planRows.reduce(
    (min, r) => (r.generatedAt < min ? r.generatedAt : min),
    planRows[0].generatedAt
  );

  const profileUpdated  = profileRows[0]?.updatedAt;
  const protocolUpdated = protocolRows[0]?.updatedAt;
  const latestEvent     = eventRows.length > 0
    ? eventRows.reduce((max, e) => (e.updatedAt > max ? e.updatedAt : max), eventRows[0].updatedAt)
    : null;
  const latestWeight    = weightRows[0]?.weighedAt ?? null;

  const stale =
    (profileUpdated  && profileUpdated  > minGeneratedAt) ||
    (protocolUpdated && protocolUpdated > minGeneratedAt) ||
    (latestEvent     && latestEvent     > minGeneratedAt) ||
    (latestWeight    && latestWeight    > minGeneratedAt)
    ? true
    : false;

  return NextResponse.json({ stale });
}
