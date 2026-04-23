// Weight helpers — weight_log is the single source of truth for user weight.
// All read sites should use getCurrentWeightKg; every code path that creates
// or updates a weight_log row must call recalculateMaintenanceCalories so
// estimated_maintenance_calories stays in step with the user's actual weight.

import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { weightLog, userProfiles } from "@/lib/db/schema";

export class NoWeightLogError extends Error {
  constructor(clerkUserId: string) {
    super(`No weight_log entries found for user ${clerkUserId}`);
    this.name = "NoWeightLogError";
  }
}

// Latest weigh-in by log_date. Throws NoWeightLogError if the user has none —
// callers shouldn't fall back silently to a stale or default value.
export async function getCurrentWeightKg(clerkUserId: string): Promise<number> {
  const rows = await db
    .select({ weightKg: weightLog.weightKg })
    .from(weightLog)
    .where(eq(weightLog.clerkUserId, clerkUserId))
    .orderBy(desc(weightLog.logDate))
    .limit(1);

  if (rows.length === 0) throw new NoWeightLogError(clerkUserId);
  return Number(rows[0].weightKg);
}

// Mifflin-St Jeor BMR × 1.2 sedentary multiplier. Activity burn is added per
// day by the plan engine from actual calendar events (duration, intensity).
function mifflinStJeorMaintenance(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string,
): number {
  const bmr =
    sex === "male"   ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : sex === "female" ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    :                    10 * weightKg + 6.25 * heightCm - 5 * age - 78;
  return Math.round(bmr * 1.2);
}

// Recompute estimated_maintenance_calories from the user's chosen mode and
// write it back to user_profiles. Returns the new value, or null if it
// couldn't compute (missing height/age/sex or no weight_log entries).
export async function recalculateMaintenanceCalories(
  clerkUserId: string,
): Promise<number | null> {
  const [profile] = await db
    .select({
      heightCm:              userProfiles.heightCm,
      age:                   userProfiles.age,
      sex:                   userProfiles.sex,
      maintenanceRecalcMode: userProfiles.maintenanceRecalcMode,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);

  if (!profile || !profile.heightCm || !profile.age || !profile.sex) return null;

  const mode = profile.maintenanceRecalcMode === "latest" ? "latest" : "rolling_7d";

  let weightKg: number;
  if (mode === "latest") {
    const rows = await db
      .select({ weightKg: weightLog.weightKg })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, clerkUserId))
      .orderBy(desc(weightLog.logDate))
      .limit(1);
    if (rows.length === 0) return null;
    weightKg = Number(rows[0].weightKg);
  } else {
    // rolling_7d: average all weigh-ins in the last 7 days inclusive of today.
    // Six days back from today gives a 7-day inclusive window.
    const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000);
    const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];
    const rows = await db
      .select({ weightKg: weightLog.weightKg })
      .from(weightLog)
      .where(and(
        eq(weightLog.clerkUserId, clerkUserId),
        gte(weightLog.logDate, sixDaysAgoStr),
      ));
    if (rows.length === 0) return null;
    weightKg = rows.reduce((s, r) => s + Number(r.weightKg), 0) / rows.length;
  }

  const maintenance = mifflinStJeorMaintenance(
    weightKg,
    profile.heightCm,
    profile.age,
    profile.sex,
  );

  await db
    .update(userProfiles)
    .set({ estimatedMaintenanceCalories: maintenance, updatedAt: new Date() })
    .where(eq(userProfiles.clerkUserId, clerkUserId));

  return maintenance;
}
