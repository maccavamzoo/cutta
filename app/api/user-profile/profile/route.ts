import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Only update fields that are explicitly provided in the body
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.targetWeightKg !== undefined)
    update.targetWeightKg = body.targetWeightKg ? String(body.targetWeightKg) : null;

  if (body.typicalWeeklyHours !== undefined)
    update.typicalWeeklyHours = body.typicalWeeklyHours ? String(body.typicalWeeklyHours) : null;

  if (body.sessionTypes !== undefined)
    update.sessionTypes = Array.isArray(body.sessionTypes) ? body.sessionTypes : [];

  if (body.usualIntensity !== undefined)
    update.usualIntensity = body.usualIntensity || null;

  if (body.fastedTraining !== undefined) {
    update.fastedTraining =
      body.fastedTraining === "yes" ? true
      : body.fastedTraining === "no" ? false
      : null;
  }

  if (body.trainingTimePreference !== undefined)
    update.trainingTimePreference = body.trainingTimePreference || null;

  if (body.trainingEnvironment !== undefined)
    update.trainingEnvironment = body.trainingEnvironment || null;

  if (body.gutSensitivity !== undefined)
    update.gutSensitivity = body.gutSensitivity || null;

  if (body.foodExclusions !== undefined)
    update.foodExclusions = Array.isArray(body.foodExclusions) ? body.foodExclusions : [];

  if (body.currentSupplements !== undefined)
    update.currentSupplements = Array.isArray(body.currentSupplements) ? body.currentSupplements : [];

  if (body.appetiteProfile !== undefined)
    update.appetiteProfile = body.appetiteProfile || null;

  if (body.preferredMealTiming !== undefined)
    update.preferredMealTiming = body.preferredMealTiming || null;

  if (body.estimatedMaintenanceCalories !== undefined)
    update.estimatedMaintenanceCalories = body.estimatedMaintenanceCalories
      ? Number(body.estimatedMaintenanceCalories)
      : null;

  const result = await db
    .update(userProfiles)
    .set(update)
    .where(eq(userProfiles.clerkUserId, userId))
    .returning({ id: userProfiles.id });

  if (result.length === 0)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}
