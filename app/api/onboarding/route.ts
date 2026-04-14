import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const values = {
    clerkUserId: userId,
    // Body stats — numeric columns stored as strings in Drizzle (pg numeric type)
    currentWeightKg: body.currentWeightKg ? String(body.currentWeightKg) : null,
    targetWeightKg: body.targetWeightKg ? String(body.targetWeightKg) : null,
    heightCm: body.heightCm ? Number(body.heightCm) : null,
    age: body.age ? Number(body.age) : null,
    sex: body.sex || null,
    weightLossRate: (body.weightLossRate as string | undefined) || "moderate",
    targetSetAt: new Date(),
    // Calorie baseline
    estimatedMaintenanceCalories: body.estimatedMaintenanceCalories
      ? Number(body.estimatedMaintenanceCalories)
      : null,
    // Gut health
    trackStoolHealth: body.trackStoolHealth === true,
    foodExclusions:   (body.foodExclusions as string[]) ?? [],
    preferredFoods:   (body.preferredFoods as string[]) ?? [],
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
        currentWeightKg: values.currentWeightKg,
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
        onboardingComplete: true,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
