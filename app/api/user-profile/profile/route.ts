import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { userProfiles, weightLog } from "@/lib/db/schema";
import { getUserToday } from "@/lib/dates";
import { recalculateMaintenanceCalories } from "@/lib/weight";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Snapshot existing values to detect what actually changed (the form always
  // resubmits every field, so we can't treat "field present in body" as a change).
  const [existing] = await db
    .select({
      heightCm:              userProfiles.heightCm,
      age:                   userProfiles.age,
      sex:                   userProfiles.sex,
      timezone:              userProfiles.timezone,
      maintenanceRecalcMode: userProfiles.maintenanceRecalcMode,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const [latestWeight] = await db
    .select({ weightKg: weightLog.weightKg })
    .from(weightLog)
    .where(eq(weightLog.clerkUserId, userId))
    .orderBy(desc(weightLog.logDate))
    .limit(1);

  // Only update fields that are explicitly provided in the body
  const update: Record<string, unknown> = { updatedAt: new Date() };

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

  if (body.estimatedMaintenanceCalories !== undefined)
    update.estimatedMaintenanceCalories = body.estimatedMaintenanceCalories
      ? Number(body.estimatedMaintenanceCalories)
      : null;

  if (body.restDayCarbsGPerKg !== undefined)
    update.restDayCarbsGPerKg = String(body.restDayCarbsGPerKg);

  if (body.restDayProteinGPerKg !== undefined)
    update.restDayProteinGPerKg = String(body.restDayProteinGPerKg);

  let modeChanged = false;
  if (body.maintenanceRecalcMode !== undefined) {
    const mode = body.maintenanceRecalcMode === "latest" ? "latest" : "rolling_7d";
    update.maintenanceRecalcMode = mode;
    modeChanged = mode !== existing.maintenanceRecalcMode;
  }

  await db
    .update(userProfiles)
    .set(update)
    .where(eq(userProfiles.clerkUserId, userId));

  // "Current weight" in Settings flows through weight_log so the recalc
  // pipeline stays consistent with the dashboard weigh-in.
  let weightChanged = false;
  if (body.currentWeightKg !== undefined && body.currentWeightKg !== null) {
    const weightKg = Number(body.currentWeightKg);
    if (Number.isFinite(weightKg) && weightKg >= 20 && weightKg <= 400) {
      const newWeightStr = weightKg.toFixed(1);
      const previousWeightStr = latestWeight?.weightKg
        ? Number(latestWeight.weightKg).toFixed(1)
        : null;
      if (newWeightStr !== previousWeightStr) {
        const { todayStr } = getUserToday(existing.timezone ?? null);
        const now = new Date();
        await db
          .insert(weightLog)
          .values({
            clerkUserId: userId,
            logDate:     todayStr,
            weighedAt:   now,
            weightKg:    newWeightStr,
          })
          .onConflictDoUpdate({
            target: [weightLog.clerkUserId, weightLog.logDate],
            set: { weighedAt: now, weightKg: newWeightStr },
          });
        weightChanged = true;
      }
    }
  }

  // Recompute when something that drives the formula has actually changed.
  // Skipping this when nothing changed lets a user save a manual override
  // (estimatedMaintenanceCalories) without it being immediately overwritten.
  const heightChanged = body.heightCm !== undefined && (Number(body.heightCm) || null) !== (existing.heightCm ?? null);
  const ageChanged    = body.age      !== undefined && (Number(body.age)      || null) !== (existing.age      ?? null);
  const sexChanged    = body.sex      !== undefined && (body.sex || null)              !== (existing.sex      ?? null);

  if (weightChanged || heightChanged || ageChanged || sexChanged || modeChanged) {
    await recalculateMaintenanceCalories(userId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/progress");

  return NextResponse.json({ success: true });
}
