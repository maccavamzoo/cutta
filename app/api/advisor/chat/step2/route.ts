import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
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

export const maxDuration = 30;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

function validateStrategyUpdate(obj: unknown): { valid: true; data: { ingredientPool: string[]; shoppingItems: ShoppingItem[] } } | { valid: false; error: string } {
  if (typeof obj !== "object" || obj === null) return { valid: false, error: "Not an object" };
  const u = obj as Record<string, unknown>;
  if (!Array.isArray(u.ingredientPool)) return { valid: false, error: "ingredientPool must be an array" };
  if (!Array.isArray(u.shoppingItems)) return { valid: false, error: "shoppingItems must be an array" };
  for (const it of u.shoppingItems) {
    if (typeof it !== "object" || it === null || typeof (it as Record<string, unknown>).item !== "string") {
      return { valid: false, error: "Each shoppingItem must have an item string" };
    }
  }
  return { valid: true, data: { ingredientPool: u.ingredientPool as string[], shoppingItems: u.shoppingItems as ShoppingItem[] } };
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
Current weight: ${latestWeightKg ? `${latestWeightKg} kg` : "unknown"}
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
When helping the user create or configure an activity type, be explicit about what each number does. Group fields into these buckets when discussing them:

- **Day's macro targets (when this activity drives the day's fuelling)**: carbs_g_per_kg and protein_g_per_kg. These set the whole day's carb and protein grams (multiplied by body weight), NOT the amount consumed during the activity itself. If multiple activities are scheduled on the same day and they have different g/kg values, the user picks which one drives that day's macro rule at plan-generation time.
- **Activity burn**: burn_rate_kcal_per_min × default_duration_minutes = estimated calories burned during the activity. This is summed across all activities scheduled on the same day.
- **Fuelling window**: pre (timing + focus), during (carbs/hr + description), post (timing + focus + protein/carbs g/kg). These are specific to this activity session.
- **Defaults**: default_duration_minutes, is_race.

Typical values to suggest:
- Burn rate (kcal/min): Cycling easy 5, moderate 8, hard 11, race 12. Running easy 7, moderate 9, hard 11. Gym 5-7.
- Day carbs g/kg: low intensity 3-4, moderate 5-6, high 7-9, race 8-10.
- Day protein g/kg: generally 1.6-2.2; higher for strength work.
- During-activity carbs: 0 for short/easy, 30-40g/hr moderate, 60-80g/hr hard, 80-100g/hr racing. Null for gym/strength.
- Pre-activity timing: 2-3 hrs for big sessions, 1-2 hrs for light ones.
- Post-activity: generally 0.3g/kg protein and 0.6-1.0g/kg carbs within 30 min.

Day macro targets (g/kg) do not depend on the user's body weight directly — they're per-kg rules. Do not ask for body weight when creating activity types.

Walk the user through the values first and propose a complete draft for their confirmation. When the user agrees (in any form — "yes", "ok", "save it", "do it", "sounds good", "go ahead", "create it", "yep", "👍", or any clear agreement), output the complete activity type as JSON inside <activity_type> tags in the SAME response as your reply:
<activity_type>
{"name":"Hard ride","description":"Intervals, threshold, hill reps","burn_rate_kcal_per_min":11,"carbs_g_per_kg":7,"protein_g_per_kg":1.8,"pre_timing_hours_before":2,"pre_focus":"High carb, low fibre, moderate protein","during_carbs_per_hour":60,"during_description":"Energy drink or gels","post_timing_minutes_after":30,"post_focus":"Protein and carbs for recovery","post_protein_g_per_kg":0.3,"post_carbs_g_per_kg":1.0,"default_duration_minutes":90,"is_race":false}
</activity_type>

CRITICAL — how saving actually works:
- The user saves the activity type by tapping a Save button that appears ONLY when you output the <activity_type> tag. Your words do not save anything — only the tag does.
- If the user agrees, the tag MUST be in the same response as your reply. Never promise to save in a later turn.
- NEVER use past-tense saving language ("saved", "I've saved", "added to your activity types", "done", "created") — the save hasn't happened until the user taps Save.
- Around the tag, use forward-looking phrasing. Good: "Here's the activity type — tap Save to add it.", "I've drafted [name] below — hit Save to confirm.". Bad: "I've saved [name] for you.".
- Keep the text response concise — don't repeat the values in prose when they're already in the tag.

If during_carbs_per_hour is 0 or not applicable (e.g. gym), set during_carbs_per_hour to null and during_description to null.

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

  let body: { message: string; conversationHistory: ChatMessage[]; requestedData: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, conversationHistory, requestedData } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const now = new Date();
  const sevenDaysAgoStr = new Date(now.getTime() - 7 * 86_400_000).toISOString().split("T")[0];
  const sevenDaysLater  = new Date(now.getTime() + 7 * 86_400_000);

  const needProfile       = requestedData.includes("Profile");
  const needActivityTypes = requestedData.includes("Activity types");
  const needShopping      = requestedData.includes("Shopping");
  const needCalendar      = requestedData.includes("Calendar");
  const needFeedback      = requestedData.includes("Feedback");
  const needWeight        = requestedData.includes("Weight");

  type ProfileRow    = typeof userProfiles.$inferSelect;
  type ActivityRow   = typeof userActivityTypes.$inferSelect;
  type StrategyRow   = { id: number; name: string; ingredientPool: unknown; shoppingItems: unknown };
  type EventRow      = { scheduledAt: Date; title: string; eventType: string; durationMinutes: number | null };
  type ComplianceRow = { logDate: string; compliance: string };
  type FeedbackRow   = { feedbackType: string; rating: number | null; planDate: string };
  type WeightRow     = { weightKg: unknown };

  const [profileRows, activityTypeRows, strategyRows, eventRows, complianceRows, feedbackRows, weightRows] =
    await Promise.all([
      needProfile
        ? db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1) as Promise<ProfileRow[]>
        : Promise.resolve([] as ProfileRow[]),

      needActivityTypes
        ? db.select().from(userActivityTypes).where(eq(userActivityTypes.clerkUserId, userId)).orderBy(userActivityTypes.sortOrder) as Promise<ActivityRow[]>
        : Promise.resolve([] as ActivityRow[]),

      needShopping
        ? db.select({ id: weeklyStrategies.id, name: weeklyStrategies.name, ingredientPool: weeklyStrategies.ingredientPool, shoppingItems: weeklyStrategies.shoppingItems })
            .from(weeklyStrategies)
            .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
            .limit(1) as Promise<StrategyRow[]>
        : Promise.resolve([] as StrategyRow[]),

      needCalendar
        ? db.select({ scheduledAt: calendarEvents.scheduledAt, title: calendarEvents.title, eventType: calendarEvents.eventType, durationMinutes: calendarEvents.durationMinutes })
            .from(calendarEvents)
            .where(and(eq(calendarEvents.clerkUserId, userId), gte(calendarEvents.scheduledAt, now), lt(calendarEvents.scheduledAt, sevenDaysLater)))
            .orderBy(calendarEvents.scheduledAt) as Promise<EventRow[]>
        : Promise.resolve([] as EventRow[]),

      needFeedback
        ? db.select({ logDate: complianceLog.logDate, compliance: complianceLog.compliance })
            .from(complianceLog)
            .where(and(eq(complianceLog.clerkUserId, userId), gte(complianceLog.logDate, sevenDaysAgoStr)))
            .orderBy(desc(complianceLog.logDate))
            .limit(7) as Promise<ComplianceRow[]>
        : Promise.resolve([] as ComplianceRow[]),

      needFeedback
        ? db.select({ feedbackType: feedbackLog.feedbackType, rating: feedbackLog.rating, planDate: feedbackLog.planDate })
            .from(feedbackLog)
            .where(and(eq(feedbackLog.clerkUserId, userId), gte(feedbackLog.planDate, sevenDaysAgoStr)))
            .limit(20) as Promise<FeedbackRow[]>
        : Promise.resolve([] as FeedbackRow[]),

      needWeight
        ? db.select({ weightKg: weightLog.weightKg })
            .from(weightLog)
            .where(eq(weightLog.clerkUserId, userId))
            .orderBy(desc(weightLog.weighedAt))
            .limit(1) as Promise<WeightRow[]>
        : Promise.resolve([] as WeightRow[]),
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
    profile:          needProfile  ? profile as Record<string, unknown> | null : null,
    latestWeightKg:   needWeight   ? latestWeightKg : null,
    timezone,
    activityTypes:    needActivityTypes ? activityTypes : [],
    restDayMacros:    needProfile  ? restDayMacros : null,
    strategyRow:      needShopping ? strategyRow : null,
    upcomingEvents:   needCalendar ? eventRows : [],
    recentCompliance: needFeedback ? complianceRows : [],
    recentFeedback:   needFeedback ? feedbackRows : [],
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawReply: string;
  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system:     systemPrompt,
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: message.trim() },
      ],
    });
    const block = response.content[0];
    rawReply = block.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[advisor/chat/step2] Anthropic error:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }

  // ── Parse strategy update ─────────────────────────────────────────────────
  const strategyMatch = rawReply.match(/<strategy_update>([\s\S]*?)<\/strategy_update>/);
  let proposedStrategyUpdate: { ingredientPool: string[]; shoppingItems: ShoppingItem[] } | null = null;
  let strategyValidationError: string | null = null;

  if (strategyMatch) {
    try {
      const parsed = JSON.parse(strategyMatch[1].trim());
      const result = validateStrategyUpdate(parsed);
      if (result.valid) {
        proposedStrategyUpdate = result.data;
        if (strategyRow) {
          await db
            .update(weeklyStrategies)
            .set({ proposedUpdate: proposedStrategyUpdate, updatedAt: new Date() })
            .where(eq(weeklyStrategies.id, strategyRow.id));
        }
      } else {
        strategyValidationError = result.error;
      }
    } catch {
      strategyValidationError = "AI returned invalid JSON in the strategy update block.";
    }
  }

  // ── Parse activity type proposal ───────────────────────────────────────────
  const activityTypeMatch = rawReply.match(/<activity_type>([\s\S]*?)<\/activity_type>/);
  let proposedActivityType: Record<string, unknown> | null = null;
  let activityTypeValidationError: string | null = null;

  if (activityTypeMatch) {
    try {
      const parsed = JSON.parse(activityTypeMatch[1].trim());
      if (typeof parsed.name !== "string" || !parsed.name.trim()) {
        activityTypeValidationError = "Missing activity type name.";
      } else if (typeof parsed.burn_rate_kcal_per_min !== "number") {
        activityTypeValidationError = "Missing burn rate.";
      } else if (typeof parsed.carbs_g_per_kg !== "number") {
        activityTypeValidationError = "Missing carbs g/kg.";
      } else if (typeof parsed.protein_g_per_kg !== "number") {
        activityTypeValidationError = "Missing protein g/kg.";
      } else {
        proposedActivityType = parsed;
      }
    } catch {
      activityTypeValidationError = "AI returned invalid JSON in activity type block.";
    }
  }

  const reply = rawReply
    .replace(/<strategy_update>[\s\S]*?<\/strategy_update>/g, "")
    .replace(/<activity_type>[\s\S]*?<\/activity_type>/g, "")
    .trim();

  return NextResponse.json({
    reply,
    systemPrompt,
    proposedStrategyUpdate,
    strategyValidationError,
    proposedActivityType,
    activityTypeValidationError,
  });
}
