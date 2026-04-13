import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Only update fields that are explicitly provided in the body
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.currentWeightKg !== undefined)
    update.currentWeightKg = body.currentWeightKg ? String(body.currentWeightKg) : null;

  if (body.targetWeightKg !== undefined)
    update.targetWeightKg = body.targetWeightKg ? String(body.targetWeightKg) : null;

  if (body.heightCm !== undefined)
    update.heightCm = body.heightCm ? Number(body.heightCm) : null;

  if (body.age !== undefined)
    update.age = body.age ? Number(body.age) : null;

  if (body.sex !== undefined)
    update.sex = body.sex || null;

  if (body.weightLossRate !== undefined)
    update.weightLossRate = body.weightLossRate || null;

  if (body.targetSetAt !== undefined)
    update.targetSetAt = body.targetSetAt ? new Date(body.targetSetAt) : null;

  if (body.trackStoolHealth !== undefined)
    update.trackStoolHealth = Boolean(body.trackStoolHealth);

  if (body.foodExclusions !== undefined)
    update.foodExclusions = Array.isArray(body.foodExclusions) ? body.foodExclusions : [];

  if (body.preferredFoods !== undefined)
    update.preferredFoods = Array.isArray(body.preferredFoods) ? body.preferredFoods : [];

  if (body.appetiteProfile !== undefined)
    update.appetiteProfile = body.appetiteProfile || null;

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

  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/progress");

  return NextResponse.json({ success: true });
}
