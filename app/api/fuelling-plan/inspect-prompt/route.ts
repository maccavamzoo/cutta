import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userProfiles,
  userActivityTypes,
  calendarEvents,
  fuellingPlans,
  complianceLog,
  feedbackLog,
  weeklyStrategies,
} from "@/lib/db/schema";
import { computeDayBrief, resolveActivityType, type PlanEngineInput } from "@/lib/plan-engine";
import { buildDayPlanPrompt } from "@/lib/ai/buildDayPlanPrompt";
import { rowToActivityType } from "@/lib/protocol";
import { parseRate } from "@/lib/weight-projection";

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse and validate date ────────────────────────────────────────────
  let date: string;
  try {
    const body = await req.json();
    date = body.date;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'A valid "date" string (YYYY-MM-DD) is required.' },
      { status: 400 }
    );
  }

  const requestedDate = new Date(date + "T00:00:00.000Z");
  if (isNaN(requestedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date value." }, { status: 400 });
  }

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const maxAllowed = new Date(todayUTC.getTime() + 10 * 86_400_000);

  if (requestedDate < todayUTC || requestedDate > maxAllowed) {
    return NextResponse.json(
      { error: "Date must be today or within the next 10 days." },
      { status: 400 }
    );
  }

  // ── 3. Compute adjacent date strings ─────────────────────────────────────
  const dateStart     = requestedDate;
  const dateEnd       = new Date(dateStart.getTime() + 86_400_000 - 1);
  const tomorrowStart = new Date(dateStart.getTime() + 86_400_000);
  const tomorrowEnd   = new Date(tomorrowStart.getTime() + 86_400_000 - 1);
  const yesterdayStr  = new Date(dateStart.getTime() - 86_400_000).toISOString().split("T")[0];

  const sevenDaysAgo    = new Date(todayUTC.getTime() - 7 * 86_400_000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // ── 4. Fetch all required data in parallel ────────────────────────────────
  let profileRows:        (typeof userProfiles.$inferSelect)[];
  let activityTypeRows:   (typeof userActivityTypes.$inferSelect)[];
  let todayEventRows:     (typeof calendarEvents.$inferSelect)[];
  let tomorrowEventRows:  (typeof calendarEvents.$inferSelect)[];
  let yesterdayEventRows: (typeof calendarEvents.$inferSelect)[];
  let yesterdayPlanRows:  (typeof fuellingPlans.$inferSelect)[];
  let complianceRows:     { compliance: string }[];
  let feedbackRows:       { feedbackType: string; rating: number }[];
  let strategyRows:       { ingredientPool: unknown }[];

  try {
    [
      profileRows,
      activityTypeRows,
      todayEventRows,
      tomorrowEventRows,
      yesterdayEventRows,
      yesterdayPlanRows,
      complianceRows,
      feedbackRows,
      strategyRows,
    ] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1),

      db.select().from(userActivityTypes).where(eq(userActivityTypes.clerkUserId, userId)).orderBy(userActivityTypes.sortOrder),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, dateStart),
          lte(calendarEvents.scheduledAt, dateEnd),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, tomorrowStart),
          lte(calendarEvents.scheduledAt, tomorrowEnd),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(calendarEvents).where(
        and(
          eq(calendarEvents.clerkUserId, userId),
          gte(calendarEvents.scheduledAt, new Date(dateStart.getTime() - 86_400_000)),
          lte(calendarEvents.scheduledAt, new Date(dateStart.getTime() - 1)),
        )
      ).orderBy(calendarEvents.scheduledAt),

      db.select().from(fuellingPlans).where(
        and(eq(fuellingPlans.clerkUserId, userId), eq(fuellingPlans.planDate, yesterdayStr))
      ).limit(1),

      db.select({ compliance: complianceLog.compliance }).from(complianceLog).where(
        and(
          eq(complianceLog.clerkUserId, userId),
          gte(complianceLog.logDate, sevenDaysAgoStr),
        )
      ),

      db.select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating })
        .from(feedbackLog)
        .where(
          and(
            eq(feedbackLog.clerkUserId, userId),
            gte(feedbackLog.planDate, sevenDaysAgoStr),
          )
        ),

      db.select({ ingredientPool: weeklyStrategies.ingredientPool })
        .from(weeklyStrategies)
        .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
        .limit(1),
    ]) as [
      typeof profileRows,
      typeof activityTypeRows,
      typeof todayEventRows,
      typeof tomorrowEventRows,
      typeof yesterdayEventRows,
      typeof yesterdayPlanRows,
      typeof complianceRows,
      typeof feedbackRows,
      typeof strategyRows,
    ];
  } catch (err) {
    console.error("[fuelling-plan/inspect-prompt] db-fetch:", err);
    return NextResponse.json(
      { error: "Database error while loading your data. Please try again." },
      { status: 500 }
    );
  }

  // ── 5. Guard checks ───────────────────────────────────────────────────────
  const profile = profileRows[0];
  if (!profile) {
    return NextResponse.json(
      { error: "No profile found. Complete onboarding first." },
      { status: 422 }
    );
  }
  if (!profile.onboardingComplete) {
    return NextResponse.json(
      { error: "Onboarding is not complete. Finish setting up your profile before generating a plan." },
      { status: 422 }
    );
  }

  if (activityTypeRows.length === 0) {
    return NextResponse.json(
      { error: "No activity types found. Go to Settings → Activity types and add at least one." },
      { status: 422 }
    );
  }

  if (!profile.estimatedMaintenanceCalories) {
    return NextResponse.json(
      { error: "Maintenance calories not set. Complete your profile first." },
      { status: 422 }
    );
  }

  // ── 6. Convert DB rows to ActivityType[] ─────────────────────────────────
  const activityTypes = activityTypeRows.map(rowToActivityType);

  const restDayMacros = {
    carbs_g_per_kg:   Number(profile.restDayCarbsGPerKg) || 3,
    protein_g_per_kg: Number(profile.restDayProteinGPerKg) || 2,
  };

  // ── 7. Compute guardrail counts from feedback ────────────────────────────
  const hungerEntries = feedbackRows.filter((f) => f.feedbackType === "hunger");
  const energyEntries = feedbackRows.filter((f) => f.feedbackType === "ride_energy");
  const stoolEntries  = feedbackRows.filter((f) => f.feedbackType === "stool_health");

  const recentFeedback: PlanEngineInput["recentFeedback"] = {
    highHungerDays:    hungerEntries.filter((f) => f.rating >= 4).length,
    lowEnergyDays:     energyEntries.filter((f) => f.rating <= 2).length,
    looseStoolDays:    stoolEntries.filter((f)  => f.rating <= 2).length,
    constipatedDays:   stoolEntries.filter((f)  => f.rating >= 4).length,
    lowComplianceDays: complianceRows.filter((c) => c.compliance === "no").length,
  };

  // ── 8. Build PlanEngineInput ──────────────────────────────────────────────
  const yesterdayPlan     = yesterdayPlanRows[0] ?? null;
  const yesterdayMeals    = (yesterdayPlan?.meals as { name: string }[] | null)
    ?.map((m) => m.name) ?? [];
  const previousGlycogen      = yesterdayPlan?.glycogenBattery ?? null;
  const previousDayHadTraining = yesterdayEventRows.some((e) => e.eventType !== "rest");

  const todayPrimaryRow = todayEventRows.length > 0
    ? todayEventRows.reduce((a, b) => (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a)
    : null;
  const tomorrowPrimaryRow = tomorrowEventRows.length > 0
    ? tomorrowEventRows.reduce((a, b) => (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a)
    : null;

  const todayActivityType    = todayPrimaryRow    ? resolveActivityType(activityTypes, todayPrimaryRow.eventType)    : null;
  const tomorrowActivityType = tomorrowPrimaryRow ? resolveActivityType(activityTypes, tomorrowPrimaryRow.eventType) : null;

  const input: PlanEngineInput = {
    currentWeightKg:        Number(profile.currentWeightKg ?? 75),
    maintenanceCalories:    profile.estimatedMaintenanceCalories,
    weightLossRate:         parseRate(profile.weightLossRate),
    foodExclusions:         (profile.foodExclusions as string[] | null) ?? [],
    preferredFoods:         (profile.preferredFoods as string[] | null) ?? [],
    restDayMacros,
    todayActivityType,
    tomorrowActivityType,
    todayEvent: todayPrimaryRow ? {
      id:              todayPrimaryRow.id,
      title:           todayPrimaryRow.title,
      scheduledAt:     todayPrimaryRow.scheduledAt.toISOString(),
      durationMinutes: todayPrimaryRow.durationMinutes,
    } : null,
    tomorrowEvent: tomorrowPrimaryRow ? {
      durationMinutes: tomorrowPrimaryRow.durationMinutes,
      scheduledAt:     tomorrowPrimaryRow.scheduledAt.toISOString(),
    } : null,
    yesterdayMeals,
    ingredientPool:         (strategyRows[0]?.ingredientPool as string[] | null) ?? null,
    recentFeedback,
    previousGlycogen,
    previousDayHadTraining,
  };

  // ── 9. Pre-compute the day brief and build the prompt ────────────────────
  const brief  = computeDayBrief(input, date);
  const prompt = buildDayPlanPrompt(brief);

  return NextResponse.json({ prompt });
}
