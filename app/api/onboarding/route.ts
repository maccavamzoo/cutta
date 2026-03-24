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

  // Map fastedTraining string → boolean | null
  const fastedTraining =
    body.fastedTraining === "yes"
      ? true
      : body.fastedTraining === "no"
        ? false
        : null; // "sometimes" → null

  const values = {
    clerkUserId: userId,
    // Body stats — numeric columns stored as strings in Drizzle (pg numeric type)
    currentWeightKg: body.currentWeightKg ? String(body.currentWeightKg) : null,
    targetWeightKg: body.targetWeightKg ? String(body.targetWeightKg) : null,
    heightCm: body.heightCm ? Number(body.heightCm) : null,
    age: body.age ? Number(body.age) : null,
    sex: body.sex || null,
    // Calorie baseline
    estimatedMaintenanceCalories: body.estimatedMaintenanceCalories
      ? Number(body.estimatedMaintenanceCalories)
      : null,
    usualCarbIntakeGrams: body.usualCarbIntakeGrams
      ? Number(body.usualCarbIntakeGrams)
      : null,
    // Training
    typicalWeeklyHours: body.typicalWeeklyHours
      ? String(body.typicalWeeklyHours)
      : null,
    sessionTypes: (body.sessionTypes as string[]) ?? [],
    usualIntensity: body.usualIntensity || null,
    fastedTraining,
    trainingTimePreference: body.trainingTimePreference || null,
    trainingEnvironment: body.trainingEnvironment || null,
    // Gut health
    gutSensitivity: body.gutSensitivity || null,
    foodExclusions: (body.foodExclusions as string[]) ?? [],
    // Appetite & timing — appetiteProfile is submitted as comma-joined string
    appetiteProfile: body.appetiteProfile || null,
    preferredMealTiming: body.preferredMealTiming || null,
    // Supplements
    currentSupplements: (body.currentSupplements as string[]) ?? [],
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
        estimatedMaintenanceCalories: values.estimatedMaintenanceCalories,
        usualCarbIntakeGrams: values.usualCarbIntakeGrams,
        typicalWeeklyHours: values.typicalWeeklyHours,
        sessionTypes: values.sessionTypes,
        usualIntensity: values.usualIntensity,
        fastedTraining: values.fastedTraining,
        trainingTimePreference: values.trainingTimePreference,
        trainingEnvironment: values.trainingEnvironment,
        gutSensitivity: values.gutSensitivity,
        foodExclusions: values.foodExclusions,
        appetiteProfile: values.appetiteProfile,
        preferredMealTiming: values.preferredMealTiming,
        currentSupplements: values.currentSupplements,
        onboardingComplete: true,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
