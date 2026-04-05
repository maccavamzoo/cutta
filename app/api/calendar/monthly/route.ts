import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calendarEvents,
  fuellingPlans,
  complianceLog,
  weightLog,
  userProfiles,
} from "@/lib/db/schema";
import { getMonthBounds } from "@/lib/dates";

interface DaySummary {
  events:       { id: number; title: string; eventType: string; durationMinutes: number | null }[];
  hasPlan:      boolean;
  planCalories: number | null;
  compliance:   "yes" | "mostly" | "no" | null;
  hasWeighIn:   boolean;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid or missing month param (expected YYYY-MM)" }, { status: 400 });
  }

  // Fetch timezone
  const [tzRow] = await db
    .select({ timezone: userProfiles.timezone })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const timezone = tzRow?.timezone ?? "Europe/London";
  const { monthStart, monthEnd } = getMonthBounds(timezone, month);

  // planDate string bounds for string comparison
  const [year, mon] = month.split("-").map(Number);
  const planDateFrom = `${month}-01`;
  const nextYear     = mon === 12 ? year + 1 : year;
  const nextMon      = mon === 12 ? 1 : mon + 1;
  const planDateTo   = `${nextYear}-${String(nextMon).padStart(2, "0")}-01`;

  const [eventRows, planRows, complianceRows, weighInRows] = await Promise.all([
    db
      .select({
        id:              calendarEvents.id,
        title:           calendarEvents.title,
        eventType:       calendarEvents.eventType,
        durationMinutes: calendarEvents.durationMinutes,
        scheduledAt:     calendarEvents.scheduledAt,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, monthStart),
          lt(calendarEvents.scheduledAt, monthEnd),
        )
      ),

    db
      .select({
        planDate:      fuellingPlans.planDate,
        totalCalories: fuellingPlans.totalCalories,
      })
      .from(fuellingPlans)
      .where(
        and(
          eq(fuellingPlans.clerkUserId, userId),
          gte(fuellingPlans.planDate, planDateFrom),
          lt(fuellingPlans.planDate, planDateTo),
        )
      ),

    db
      .select({
        logDate:    complianceLog.logDate,
        compliance: complianceLog.compliance,
      })
      .from(complianceLog)
      .where(
        and(
          eq(complianceLog.clerkUserId, userId),
          gte(complianceLog.logDate, planDateFrom),
          lt(complianceLog.logDate, planDateTo),
        )
      ),

    db
      .select({ logDate: weightLog.logDate })
      .from(weightLog)
      .where(
        and(
          eq(weightLog.clerkUserId, userId),
          gte(weightLog.logDate, planDateFrom),
          lt(weightLog.logDate, planDateTo),
        )
      ),
  ]);

  // Build response grouped by date string
  const days = new Map<string, DaySummary>();

  function getDay(dateStr: string): DaySummary {
    if (!days.has(dateStr)) {
      days.set(dateStr, { events: [], hasPlan: false, planCalories: null, compliance: null, hasWeighIn: false });
    }
    return days.get(dateStr)!;
  }

  const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });

  for (const ev of eventRows) {
    const dateStr = dateFmt.format(ev.scheduledAt);
    getDay(dateStr).events.push({
      id:              ev.id,
      title:           ev.title,
      eventType:       ev.eventType,
      durationMinutes: ev.durationMinutes,
    });
  }

  for (const plan of planRows) {
    const dateStr = typeof plan.planDate === "string" ? plan.planDate : (plan.planDate as Date).toISOString().split("T")[0];
    const day     = getDay(dateStr);
    day.hasPlan      = true;
    day.planCalories = plan.totalCalories;
  }

  for (const c of complianceRows) {
    const dateStr  = typeof c.logDate === "string" ? c.logDate : (c.logDate as Date).toISOString().split("T")[0];
    getDay(dateStr).compliance = c.compliance as "yes" | "mostly" | "no";
  }

  for (const w of weighInRows) {
    const dateStr = typeof w.logDate === "string" ? w.logDate : (w.logDate as Date).toISOString().split("T")[0];
    getDay(dateStr).hasWeighIn = true;
  }

  return NextResponse.json({ days: Object.fromEntries(days) });
}
