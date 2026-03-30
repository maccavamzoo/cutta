import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ProfileEditView, { type ProfileData } from "./ProfileEditView";
import type { UnitSystem } from "@/lib/units";

export const metadata = {
  title: "Edit profile — Cutta",
};

export default async function ProfileEditPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({
      currentWeightKg:              userProfiles.currentWeightKg,
      targetWeightKg:               userProfiles.targetWeightKg,
      heightCm:                     userProfiles.heightCm,
      age:                          userProfiles.age,
      sex:                          userProfiles.sex,
      fastedTraining:               userProfiles.fastedTraining,
      gutSensitivity:               userProfiles.gutSensitivity,
      trackStoolHealth:             userProfiles.trackStoolHealth,
      foodExclusions:               userProfiles.foodExclusions,
      currentSupplements:           userProfiles.currentSupplements,
      appetiteProfile:              userProfiles.appetiteProfile,
      preferredMealTiming:          userProfiles.preferredMealTiming,
      estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
      unitSystem:                   userProfiles.unitSystem,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (!profile) redirect("/onboarding");

  const unitSystem: UnitSystem = (profile.unitSystem as UnitSystem | undefined) ?? "metric";

  const initial: ProfileData = {
    currentWeightKg:              profile.currentWeightKg ? Number(profile.currentWeightKg) : null,
    targetWeightKg:               profile.targetWeightKg  ? Number(profile.targetWeightKg)  : null,
    heightCm:                     profile.heightCm        ?? null,
    age:                          profile.age             ?? null,
    sex:                          profile.sex             ?? null,
    fastedTraining:               profile.fastedTraining               ?? null,
    gutSensitivity:               profile.gutSensitivity               ?? null,
    trackStoolHealth:             profile.trackStoolHealth             ?? false,
    foodExclusions:               profile.foodExclusions               ?? [],
    currentSupplements:           profile.currentSupplements           ?? [],
    appetiteProfile:              profile.appetiteProfile              ?? null,
    preferredMealTiming:          profile.preferredMealTiming          ?? null,
    estimatedMaintenanceCalories: profile.estimatedMaintenanceCalories ?? null,
  };

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/settings"
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Settings
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Edit profile</h1>
            <p className="text-zinc-500 text-sm">Update your training habits and food preferences.</p>
          </div>
        </div>

        <ProfileEditView initial={initial} unitSystem={unitSystem} />
      </main>

      <BottomNav active="more" />
    </>
  );
}
