import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import CalendarView from "./CalendarView";
import type { CalendarEvent } from "./AddEventSheet";

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

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.clerkUserId, userId),
        gte(calendarEvents.scheduledAt, monday),
        lt(calendarEvents.scheduledAt, nextMonday)
      )
    )
    .orderBy(calendarEvents.scheduledAt);

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
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-white mb-6">
        Calendar
      </h1>
      <CalendarView initialEvents={initialEvents} />
    </main>
  );
}
