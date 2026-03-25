import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trainingLog } from "@/lib/db/schema";

// POST — save a confirmed training log entry
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    source: string;
    activityDate: string;
    calendarEventId?: number | null;
    // Confirmed (possibly user-edited) values
    durationMinutes?: number | null;
    distanceKm?: number | null;
    avgPowerWatts?: number | null;
    avgHeartRate?: number | null;
    elevationM?: number | null;
    estimatedCalories?: number | null;
    // AI metadata
    extractionConfidence?: number | null;
    extractedData?: unknown;
    corrections?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.source || !body.activityDate) {
    return NextResponse.json(
      { error: "source and activityDate are required." },
      { status: 422 }
    );
  }

  const validSources = ["strava", "rouvy"];
  if (!validSources.includes(body.source)) {
    return NextResponse.json(
      { error: "source must be strava or rouvy." },
      { status: 422 }
    );
  }

  const [created] = await db
    .insert(trainingLog)
    .values({
      clerkUserId: userId,
      source: body.source,
      activityDate: body.activityDate,
      calendarEventId: body.calendarEventId ?? null,
      durationMinutes: body.durationMinutes ?? null,
      distanceKm: body.distanceKm != null ? String(body.distanceKm) : null,
      avgPowerWatts: body.avgPowerWatts ?? null,
      avgHeartRate: body.avgHeartRate ?? null,
      elevationM: body.elevationM ?? null,
      estimatedCalories: body.estimatedCalories ?? null,
      extractionConfidence: body.extractionConfidence ?? null,
      extractedData: body.extractedData ?? null,
      corrections: body.corrections ?? null,
      confirmed: true,
    })
    .returning();

  return NextResponse.json({ entry: created }, { status: 201 });
}
