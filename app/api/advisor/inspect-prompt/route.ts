import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userProfiles,
  userActivityTypes,
  weeklyStrategies,
  calendarEvents,
  complianceLog,
  feedbackLog,
  weightLog,
} from "@/lib/db/schema";
import { rowToActivityType, type ActivityType } from "@/lib/protocol";
import type { ShoppingItem } from "@/lib/weekly-strategy-templates";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface InspectRequest {
  message: string;
  conversationHistory: ChatMessage[];
}

// ── Schema reference for the AI ──────────────────────────────────────────────

const SCHEMAS = `
// ACTIVITY TYPE SCHEMA
interface ActivityType {
  name: string; description: string;
  burn_rate_kcal_per_min: number;
  carbs_g_per_kg: number; protein_g_per_kg: number;
  // fat_g_per_kg is NOT stored — fat is auto-calculated as the flex macro to hit the calorie target
  pre_activity: { timing_hours_before: number; focus: string; };
  during_activity: { carbs_per_hour: number; description: string; } | null;
  post_activity: { timing_minutes_after: number; focus: string; protein_g_per_kg: number; carbs_g_per_kg: number; };
  default_duration_minutes: number; is_race: boolean;
}

// SHOPPING STRATEGY SCHEMA
interface ShoppingItem { item: string; category: string; amount: string; }
interface WeeklyStrategy { ingredientPool: string[]; shoppingItems: ShoppingItem[]; }
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: unknown, fallback = "unknown"): string {
  if (v == null || v === "") return fallback;
  return String(v);
}

function fmtArr(v: unknown, fallback = "none"): string {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  return v.join(", ");
}

// ── System prompt builder ────────────────────────────────────────────────────

function fmtDateInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day:     "numeric",
    month:   "long",
  }).format(date);
}

function buildSystemPrompt(ctx: {
  profile: Record<string, unknown> | null;
  latestWeightKg: number | null;
  timezone: string;
  activityTypes: ActivityType[];
  restDayMacros: { carbs_g_per_kg: number; protein_g_per_kg: number } | null;
  strategyRow: { name: string; ingredientPool: unknown; shoppingItems: unknown } | null;
  upcomingEvents: { scheduledAt: Date; title: string; eventType: string; durationMinutes: number | null }[];
  recentCompliance: { logDate: string; compliance: string }[];
  recentFeedback: { feedbackType: string; rating: number | null; planDate: string }[];
}): string {
  const { profile, latestWeightKg, timezone, activityTypes, restDayMacros, strategyRow, upcomingEvents, recentCompliance, recentFeedback } = ctx;

  const preferredFoods = fmtArr(profile?.preferredFoods, "none logged");
  const exclusions  = fmtArr(profile?.foodExclusions, "none");

  const profileSection = profile ? `## USER PROFILE
Current weight: ${latestWeightKg ? `${latestWeightKg} kg` : (profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "unknown")}
Target weight: ${fmt(profile.targetWeightKg, "not set")} kg, loss rate: ${fmt(profile.weightLossRate, "not set")} kg/week
Height: ${fmt(profile.heightCm, "unknown")} cm | Age: ${fmt(profile.age, "unknown")} | Sex: ${fmt(profile.sex, "unknown")}
Maintenance calories: ${fmt(profile.estimatedMaintenanceCalories, "not calculated")} kcal/day
Foods to avoid: ${exclusions}
Preferred foods: ${preferredFoods}
Rest day macros: carbs ${restDayMacros?.carbs_g_per_kg ?? 3}g/kg, protein ${restDayMacros?.protein_g_per_kg ?? 2}g/kg, fat auto-calculated` : "## USER PROFILE\nNo profile data found.";

  let activitySection: string;
  if (activityTypes.length > 0) {
    const atLines = activityTypes.map((at) => {
      const during = at.during_activity
        ? at.during_activity.carbs_per_hour === 0
          ? "during: water/electrolytes only"
          : `during: ${at.during_activity.carbs_per_hour}g carbs/hr (${at.during_activity.description})`
        : "during: none";
      return `  - ${at.name}: ${at.description}\n    Macros: ${at.carbs_g_per_kg}g/kg carbs, ${at.protein_g_per_kg}g/kg protein, fat auto-calculated | ${during}\n    Pre: ${at.pre_activity.timing_hours_before}h before — ${at.pre_activity.focus}\n    Post: ${at.post_activity.timing_minutes_after}min after — ${at.post_activity.focus}`;
    }).join("\n");
    activitySection = `## ACTIVITY TYPES
${atLines}`;
  } else {
    activitySection = "## ACTIVITY TYPES\nNo activity types configured.";
  }

  let strategySection: string;
  if (strategyRow) {
    const pool  = fmtArr(strategyRow.ingredientPool, "empty");
    const items = Array.isArray(strategyRow.shoppingItems)
      ? (strategyRow.shoppingItems as ShoppingItem[]).map((it) => `  - ${it.item} (${it.category}) — ${it.amount}`).join("\n")
      : "  (none)";
    strategySection = `## WEEKLY SHOPPING STRATEGY: ${strategyRow.name}
Ingredient pool: ${pool}

Shopping list:
${items}`;
  } else {
    strategySection = "## WEEKLY SHOPPING STRATEGY\nNo active shopping strategy set.";
  }

  let calendarSection: string;
  if (upcomingEvents.length > 0) {
    const lines = upcomingEvents.map((e) => {
      const dateStr = fmtDateInTz(e.scheduledAt, timezone);
      const dur = e.durationMinutes ? `, ${e.durationMinutes}min` : "";
      return `  - ${dateStr}: ${e.title} (${e.eventType}${dur})`;
    }).join("\n");
    calendarSection = `## UPCOMING WEEK\n${lines}`;
  } else {
    calendarSection = "## UPCOMING WEEK\nNo events scheduled for the next 7 days.";
  }

  let feedbackSection = "## RECENT FEEDBACK (last 7 days)\n";
  if (recentCompliance.length === 0 && recentFeedback.length === 0) {
    feedbackSection += "No recent check-ins or feedback.";
  } else {
    if (recentCompliance.length > 0) {
      feedbackSection += "Plan compliance:\n" + recentCompliance.map((c) => `  - ${c.logDate}: ${c.compliance}`).join("\n") + "\n";
    }
    if (recentFeedback.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const f of recentFeedback) {
        if (!grouped[f.feedbackType]) grouped[f.feedbackType] = [];
        grouped[f.feedbackType].push(`${f.planDate}: ${f.rating ?? "?"}/5`);
      }
      feedbackSection += "Feedback ratings:\n" + Object.entries(grouped).map(([type, entries]) => `  ${type}: ${entries.join(", ")}`).join("\n");
    }
  }

  const capabilitiesSection = `## YOUR CAPABILITIES

You can:
1. Answer questions about nutrition, fuelling, training-related diet, activity types, their shopping list, or general sports science
2. Modify the weekly shopping strategy — change the ingredient pool and shopping list

When modifying the SHOPPING STRATEGY, output the update inside <strategy_update> tags:
<strategy_update>
{"ingredientPool":["item1","item2"],"shoppingItems":[{"item":"Chicken breast","category":"protein","amount":"1 kg"}]}
</strategy_update>

Rules:
- Only include update tags when actually making changes, not when answering questions
- Shopping updates: output the COMPLETE ingredient pool and shopping list
- Keep responses concise and practical — you're talking to a cyclist, not writing a textbook
- Use UK English
- Activity types and rest day macros are managed by the user in Settings — you can advise on values but cannot directly change them
- When making shopping changes, consider what the activity types require

## ACTIVITY TYPE GUIDANCE
When the user asks for help creating or configuring an activity type, help them determine appropriate values:
- Burn rate (kcal/min): depends on intensity and sport. Cycling: easy 5, moderate 8, hard 11, race 12. Running: easy 7, moderate 9, hard 11. Gym: 5-7.
- Carbs g/kg: low intensity 3-4, moderate 5-6, high 7-9, race 8-10.
- Protein g/kg: generally 1.6-2.2 regardless of activity. Higher for strength work.
- During-activity carbs: 0 for short/easy sessions, 30-40g/hr moderate, 60-80g/hr hard, 80-100g/hr racing. Null for gym/strength.
- Pre-activity timing: 2-3 hrs for big sessions, 1-2 hrs for light ones.
- Post-activity: generally 0.3g/kg protein and 0.6-1.0g/kg carbs within 30 min.

When you've helped them decide on values, present the complete activity type clearly so they can enter it on the Activity Types settings page. Format it as a clear summary they can reference while filling in the form.

${SCHEMAS}`;

  return `You are Cutta, an AI performance fuelling advisor for an endurance cyclist. You help with nutrition, fuelling, shopping strategy, and training-related nutrition questions.

${profileSection}

${activitySection}

${strategySection}

${calendarSection}

${feedbackSection}

${capabilitiesSection}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: InspectRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const now = new Date();
  const sevenDaysAgoStr = new Date(now.getTime() - 7 * 86_400_000).toISOString().split("T")[0];
  const sevenDaysLater  = new Date(now.getTime() + 7 * 86_400_000);

  const [profileRows, activityTypeRows, strategyRows, eventRows, complianceRows, feedbackRows, weightRows] =
    await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1),

      db.select().from(userActivityTypes).where(eq(userActivityTypes.clerkUserId, userId)).orderBy(userActivityTypes.sortOrder),

      db.select({ id: weeklyStrategies.id, name: weeklyStrategies.name, ingredientPool: weeklyStrategies.ingredientPool, shoppingItems: weeklyStrategies.shoppingItems })
        .from(weeklyStrategies)
        .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
        .limit(1),

      db.select({ scheduledAt: calendarEvents.scheduledAt, title: calendarEvents.title, eventType: calendarEvents.eventType, durationMinutes: calendarEvents.durationMinutes })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.clerkUserId, userId), gte(calendarEvents.scheduledAt, now), lt(calendarEvents.scheduledAt, sevenDaysLater)))
        .orderBy(calendarEvents.scheduledAt),

      db.select({ logDate: complianceLog.logDate, compliance: complianceLog.compliance })
        .from(complianceLog)
        .where(and(eq(complianceLog.clerkUserId, userId), gte(complianceLog.logDate, sevenDaysAgoStr)))
        .orderBy(desc(complianceLog.logDate))
        .limit(7),

      db.select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating, planDate: feedbackLog.planDate })
        .from(feedbackLog)
        .where(and(eq(feedbackLog.clerkUserId, userId), gte(feedbackLog.planDate, sevenDaysAgoStr)))
        .limit(20),

      db.select({ weightKg: weightLog.weightKg })
        .from(weightLog)
        .where(eq(weightLog.clerkUserId, userId))
        .orderBy(desc(weightLog.weighedAt))
        .limit(1),
    ]);

  const profile     = profileRows[0] ?? null;
  const strategyRow = strategyRows[0] ?? null;

  const activityTypes: ActivityType[] = activityTypeRows.map(rowToActivityType);
  const restDayMacros = profile ? {
    carbs_g_per_kg:   Number(profile.restDayCarbsGPerKg) || 3,
    protein_g_per_kg: Number(profile.restDayProteinGPerKg) || 2,
  } : null;

  const latestWeightKg = weightRows[0]?.weightKg ? Number(weightRows[0].weightKg) : null;
  const timezone = (profile?.timezone as string | null) ?? "Europe/London";

  const systemPrompt = buildSystemPrompt({
    profile: profile as Record<string, unknown> | null,
    latestWeightKg,
    timezone,
    activityTypes,
    restDayMacros,
    strategyRow,
    upcomingEvents: eventRows,
    recentCompliance: complianceRows as { logDate: string; compliance: string }[],
    recentFeedback:   feedbackRows as { feedbackType: string; rating: number | null; planDate: string }[],
  });

  return NextResponse.json({ systemPrompt, userMessage: message.trim() });
}
