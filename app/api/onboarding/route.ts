import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles, userActivityTypes, weightLog } from "@/lib/db/schema";
import { getUserToday } from "@/lib/dates";
import { recalculateMaintenanceCalories } from "@/lib/weight";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const values = {
    clerkUserId: userId,
    // Body stats — numeric columns stored as strings in Drizzle (pg numeric type)
    targetWeightKg: body.targetWeightKg ? String(body.targetWeightKg) : null,
    heightCm: body.heightCm ? Number(body.heightCm) : null,
    age: body.age ? Number(body.age) : null,
    sex: body.sex || null,
    weightLossRate: (body.weightLossRate as string | undefined) || "moderate",
    targetSetAt: new Date(),
    // Calorie baseline — recalculated below from the first weight_log entry.
    estimatedMaintenanceCalories: body.estimatedMaintenanceCalories
      ? Number(body.estimatedMaintenanceCalories)
      : null,
    // Gut health
    trackStoolHealth: body.trackStoolHealth === true,
    foodExclusions:   (body.foodExclusions as string[]) ?? [],
    preferredFoods:   (body.preferredFoods as string[]) ?? [],
    // Rest day macros
    restDayCarbsGPerKg:   String(body.restDayCarbsGPerKg ?? 3),
    restDayProteinGPerKg: String(body.restDayProteinGPerKg ?? 2),
    // Mark onboarding complete
    onboardingComplete: true as const,
    updatedAt: new Date(),
  };

  await db
    .insert(userProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: userProfiles.clerkUserId,
      set: {
        targetWeightKg: values.targetWeightKg,
        heightCm: values.heightCm,
        age: values.age,
        sex: values.sex,
        weightLossRate: values.weightLossRate,
        targetSetAt: values.targetSetAt,
        estimatedMaintenanceCalories: values.estimatedMaintenanceCalories,
        trackStoolHealth: values.trackStoolHealth,
        foodExclusions:   values.foodExclusions,
        preferredFoods:   values.preferredFoods,
        restDayCarbsGPerKg:   values.restDayCarbsGPerKg,
        restDayProteinGPerKg: values.restDayProteinGPerKg,
        onboardingComplete: true,
        updatedAt: new Date(),
      },
    });

  // Seed the user's first weigh-in from the onboarding form so weight_log is
  // immediately the source of truth — no fallback to user_profiles needed.
  const weightKg = body.currentWeightKg ? Number(body.currentWeightKg) : null;
  if (weightKg && Number.isFinite(weightKg) && weightKg >= 20 && weightKg <= 400) {
    const [profileRow] = await db
      .select({ timezone: userProfiles.timezone })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1);
    const { todayStr } = getUserToday(profileRow?.timezone ?? null);
    const now = new Date();
    await db
      .insert(weightLog)
      .values({
        clerkUserId: userId,
        logDate:     todayStr,
        weighedAt:   now,
        weightKg:    weightKg.toFixed(1),
      })
      .onConflictDoUpdate({
        target: [weightLog.clerkUserId, weightLog.logDate],
        set: { weighedAt: now, weightKg: weightKg.toFixed(1) },
      });

    // Recompute maintenance from the first entry (overrides whatever the
    // client-side form pre-calculated, so the rolling_7d default is honoured).
    await recalculateMaintenanceCalories(userId);
  }

  // Seed a default activity type if the user doesn't have one yet
  const existing = await db
    .select({ id: userActivityTypes.id })
    .from(userActivityTypes)
    .where(eq(userActivityTypes.clerkUserId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userActivityTypes).values({
      clerkUserId: userId,
      name: "Default",
      description: "Moderate intensity activity",
      sortOrder: 0,
    });
  }

  return NextResponse.json({ success: true });
}
