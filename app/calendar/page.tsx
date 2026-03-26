import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents, userProfiles, protocols, weightLog } from "@/lib/db/schema";
import CalendarView from "./CalendarView";
import type { CalendarEvent } from "./AddEventSheet";
import BottomNav from "@/components/BottomNav";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function CalendarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const monday = getMondayOfWeek(new Date());
  const nextMonday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [rows, profileRows, protocolRows, latestWeightRows] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, monday),
          lt(calendarEvents.scheduledAt, nextMonday)
        )
      )
      .orderBy(calendarEvents.scheduledAt),

    db
      .select({
        currentWeightKg: userProfiles.currentWeightKg,
        estimatedMaintenanceCalories: userProfiles.estimatedMaintenanceCalories,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),

    db
      .select({ weightKg: weightLog.weightKg })
      .from(weightLog)
      .where(eq(weightLog.clerkUserId, userId))
      .orderBy(desc(weightLog.weighedAt))
      .limit(1),
  ]);

  // Compute daily weight-loss projection from calorie deficit
  const maintenance = profileRows[0]?.estimatedMaintenanceCalories
    ? Number(profileRows[0].estimatedMaintenanceCalories)
    : null;
  const protocolContent = protocolRows[0]?.content as Record<string, Record<string, unknown>> | null;
  const restDayCals = typeof protocolContent?.rest_day?.calories === "number"
    ? protocolContent.rest_day.calories
    : maintenance ? maintenance - 350 : null;
  // 7700 kcal ≈ 1 kg fat
  const dailyWeightLossKg = maintenance && restDayCals
    ? Math.max(0, (maintenance - restDayCals) / 7700)
    : null;

  const currentWeightKg = latestWeightRows[0]?.weightKg
    ? Number(latestWeightRows[0].weightKg)
    : profileRows[0]?.currentWeightKg
    ? Number(profileRows[0].currentWeightKg)
    : null;

  // Serialize for client component (Date → ISO string)
  const initialEvents: CalendarEvent[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    scheduledAt: e.scheduledAt.toISOString(),
    durationMinutes: e.durationMinutes,
    intensity: e.intensity,
    notes: e.notes,
  }));

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 pb-24 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">
          Calendar
        </h1>
        <CalendarView
          initialEvents={initialEvents}
          currentWeightKg={currentWeightKg}
          dailyWeightLossKg={dailyWeightLossKg}
        />
      </main>
      <BottomNav active="calendar" />
    </>
  );
}
