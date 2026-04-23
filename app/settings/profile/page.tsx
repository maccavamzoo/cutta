import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles, weightLog } from "@/lib/db/schema";
import ProfileEditView, { type ProfileData } from "./ProfileEditView";
import type { UnitSystem } from "@/lib/units";

export const metadata = {
  title: "Edit profile — Cutta",
};

export default async function ProfileEditPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [[profile], latestWeightRows] = await Promise.all([
    db
      .select({
        targetWeightKg:               userProfiles.targetWeightKg,
        heightCm:                     userProfiles.heightCm,
        age:                          userProfiles.age,
        sex:                          userProfiles.sex,
        weightLossRate:               userProfiles.weightLossRate,
        targetSetAt:                  userProfiles.targetSetAt,
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
        maintenanceRecalcMode:        userProfiles.maintenanceRecalcMode,
        unitSystem:                   userProfiles.unitSystem,
        restDayCarbsGPerKg:           userProfiles.restDayCarbsGPerKg,
        restDayProteinGPerKg:         userProfiles.restDayProteinGPerKg,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),
    db
      .select({ weightKg: weightLog.weightKg })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.logDate))
      .limit(1),
  ]);

  if (!profile) redirect("/onboarding");

  const unitSystem: UnitSystem = (profile.unitSystem as UnitSystem | undefined) ?? "metric";

  const initial: ProfileData = {
    currentWeightKg:              latestWeightRows[0]?.weightKg ? Number(latestWeightRows[0].weightKg) : null,
    targetWeightKg:               profile.targetWeightKg  ? Number(profile.targetWeightKg)  : null,
    heightCm:                     profile.heightCm        ?? null,
    age:                          profile.age             ?? null,
    sex:                          profile.sex             ?? null,
    weightLossRate:               profile.weightLossRate  ?? null,
    targetSetAt:                  profile.targetSetAt ? profile.targetSetAt.toISOString() : null,
    estimatedMaintenanceCalories: profile.estimatedMaintenanceCalories ?? null,
    maintenanceRecalcMode:        (profile.maintenanceRecalcMode === "latest" ? "latest" : "rolling_7d"),
    restDayCarbsGPerKg:           profile.restDayCarbsGPerKg ? Number(profile.restDayCarbsGPerKg) : 3,
    restDayProteinGPerKg:         profile.restDayProteinGPerKg ? Number(profile.restDayProteinGPerKg) : 2,
  };

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto pb-24">
      <ProfileEditView initial={initial} unitSystem={unitSystem} backHref="/settings" />
    </main>
  );
}
