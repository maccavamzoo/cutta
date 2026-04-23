import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles, userActivityTypes } from "@/lib/db/schema";
import CalendarView from "./CalendarView";
import BottomNav from "@/components/BottomNav";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import type { UnitSystem } from "@/lib/units";

export default async function CalendarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profileRows, activityTypeRows] = await Promise.all([
    db
      .select({ timezone: userProfiles.timezone, unitSystem: userProfiles.unitSystem })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({
        name:                     userActivityTypes.name,
        description:              userActivityTypes.description,
        defaultDurationMinutes:   userActivityTypes.defaultDurationMinutes,
        carbsGPerKg:              userActivityTypes.carbsGPerKg,
        proteinGPerKg:            userActivityTypes.proteinGPerKg,
      })
      .from(userActivityTypes)
      .where(eq(userActivityTypes.clerkUserId, userId))
      .orderBy(userActivityTypes.sortOrder),
  ]);

  const profileRow  = profileRows[0] ?? null;
  const timezone    = profileRow?.timezone ?? "Europe/London";
  const unitSystem  = (profileRow?.unitSystem ?? "metric") as UnitSystem;

  const activityTypes: ActivityTypeOption[] = activityTypeRows.map((at) => ({
    name:                     at.name,
    description:              at.description ?? "",
    default_duration_minutes: at.defaultDurationMinutes ?? 60,
    carbs_g_per_kg:           Number(at.carbsGPerKg),
    protein_g_per_kg:         Number(at.proteinGPerKg),
  }));

  const monthStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone })
    .format(new Date())
    .slice(0, 7);

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4">
          <CalendarView
            initialMonth={monthStr}
            timezone={timezone}
            unitSystem={unitSystem}
            activityTypes={activityTypes}
          />
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
