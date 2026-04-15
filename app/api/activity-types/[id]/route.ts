import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { userActivityTypes } from "@/lib/db/schema";

// PATCH — update an activity type
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const activityId = Number(id);
  if (isNaN(activityId)) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined)                  update.name = body.name;
  if (body.description !== undefined)           update.description = body.description;
  if (body.burnRateKcalPerMin !== undefined)     update.burnRateKcalPerMin = String(body.burnRateKcalPerMin);
  if (body.carbsGPerKg !== undefined)           update.carbsGPerKg = String(body.carbsGPerKg);
  if (body.proteinGPerKg !== undefined)         update.proteinGPerKg = String(body.proteinGPerKg);
  if (body.preActivity !== undefined)           update.preActivity = body.preActivity;
  if (body.duringActivity !== undefined)        update.duringActivity = body.duringActivity;
  if (body.postActivity !== undefined)          update.postActivity = body.postActivity;
  if (body.defaultDurationMinutes !== undefined) update.defaultDurationMinutes = body.defaultDurationMinutes;
  if (body.isRace !== undefined)                update.isRace = body.isRace;
  if (body.sortOrder !== undefined)             update.sortOrder = body.sortOrder;

  const result = await db
    .update(userActivityTypes)
    .set(update)
    .where(and(eq(userActivityTypes.id, activityId), eq(userActivityTypes.clerkUserId, userId)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}

// DELETE — remove an activity type
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const activityId = Number(id);
  if (isNaN(activityId)) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });

  const result = await db
    .delete(userActivityTypes)
    .where(and(eq(userActivityTypes.id, activityId), eq(userActivityTypes.clerkUserId, userId)))
    .returning({ id: userActivityTypes.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
