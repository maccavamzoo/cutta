import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import ProfileEditView, { type ProfileData } from "@/app/settings/profile/ProfileEditView";

export const metadata = {
  title: "Get started — Cutta",
};

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({ onboardingComplete: userProfiles.onboardingComplete, unitSystem: userProfiles.unitSystem })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (profile?.onboardingComplete) redirect("/");

  const empty: ProfileData = {
    currentWeightKg:              null,
    targetWeightKg:               null,
    heightCm:                     null,
    age:                          null,
    sex:                          null,
    typicalWeeklyHours:           null,
    fastedTraining:               null,
    gutSensitivity:               null,
    trackStoolHealth:             false,
    foodExclusions:               [],
    currentSupplements:           [],
    appetiteProfile:              null,
    preferredMealTiming:          null,
    estimatedMaintenanceCalories: null,
  };

  return (
    <main className="min-h-dvh bg-black px-4 py-8 max-w-lg mx-auto">
      <ProfileEditView initial={empty} mode="onboarding" />
    </main>
  );
}
