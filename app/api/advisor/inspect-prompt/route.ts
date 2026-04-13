import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userProfiles,
  protocols,
  weeklyStrategies,
  calendarEvents,
  complianceLog,
  feedbackLog,
  weightLog,
} from "@/lib/db/schema";
import type { ProtocolFile } from "@/lib/protocol";
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
// PROTOCOL SCHEMA
interface MacroRange { min: number; max: number; }
interface ActivityType {
  name: string; description: string;
  calorie_offset: number; add_training_burn: boolean; burn_rate_kcal_per_min: number;
  carbs_g_per_kg: MacroRange; protein_g_per_kg: MacroRange; fat_g_per_kg: MacroRange;
  pre_activity: { timing_hours_before: number; focus: string; };
  during_activity: { carbs_per_hour: number; description: string; } | null;
  post_activity: { timing_minutes_after: number; focus: string; protein_g_per_kg: number; carbs_g_per_kg: number; };
  default_duration_minutes: number; is_race: boolean;
}
interface RestDayRules { calorie_offset: number; carbs_g_per_kg: MacroRange; protein_g_per_kg: MacroRange; fat_g_per_kg: MacroRange; }
interface ProtocolFile {
  protocol_name: string; description: string;
  rest_day: RestDayRules; activity_types: ActivityType[];
  race_week: { carb_load_days_before: number; carb_load_g_per_kg: MacroRange; race_morning_carbs_g_per_kg: number; race_morning_hours_before: number; strategy_notes: string; };
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
  protocolRow: { name: string; content: ProtocolFile } | null;
  strategyRow: { name: string; ingredientPool: unknown; shoppingItems: unknown } | null;
  upcomingEvents: { scheduledAt: Date; title: string; eventType: string; durationMinutes: number | null }[];
  recentCompliance: { logDate: string; compliance: string }[];
  recentFeedback: { feedbackType: string; rating: number | null; planDate: string }[];
}): string {
  const { profile, latestWeightKg, timezone, protocolRow, strategyRow, upcomingEvents, recentCompliance, recentFeedback } = ctx;

  // ── Profile ───────────────────────────────────────────────────────────────
  const preferredFoods = fmtArr(profile?.preferredFoods, "none logged");
  const supplements = fmtArr(profile?.currentSupplements, "none");
  const exclusions  = fmtArr(profile?.foodExclusions, "none");

  const profileSection = profile ? `## USER PROFILE
Current weight: ${latestWeightKg ? `${latestWeightKg} kg` : (profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "unknown")}
Target weight: ${fmt(profile.targetWeightKg, "not set")} kg, loss rate: ${fmt(profile.weightLossRate, "not set")} kg/week
Height: ${fmt(profile.heightCm, "unknown")} cm | Age: ${fmt(profile.age, "unknown")} | Sex: ${fmt(profile.sex, "unknown")}
Maintenance calories: ${fmt(profile.estimatedMaintenanceCalories, "not calculated")} kcal/day
Foods to avoid: ${exclusions}
Preferred foods: ${preferredFoods}
Supplements: ${supplements}
Eating style: ${fmt(profile.appetiteProfile, "not specified")}` : "## USER PROFILE\nNo profile data found.";

  // ── Protocol ──────────────────────────────────────────────────────────────
  let protocolSection: string;
  if (protocolRow) {
    const p = protocolRow.content;
    const atLines = p.activity_types.map((at) => {
      const carbsRange = `${at.carbs_g_per_kg.min}–${at.carbs_g_per_kg.max}g/kg`;
      const protRange  = `${at.protein_g_per_kg.min}–${at.protein_g_per_kg.max}g/kg`;
      const fatRange   = `${at.fat_g_per_kg.min}–${at.fat_g_per_kg.max}g/kg`;
      const during = at.during_activity
        ? at.during_activity.carbs_per_hour === 0
          ? "during: water/electrolytes only"
          : `during: ${at.during_activity.carbs_per_hour}g carbs/hr (${at.during_activity.description})`
        : "during: none";
      return `  - ${at.name}: ${at.description}\n    Macros: ${carbsRange} carbs, ${protRange} protein, ${fatRange} fat | ${during}\n    Pre: ${at.pre_activity.timing_hours_before}h before — ${at.pre_activity.focus}\n    Post: ${at.post_activity.timing_minutes_after}min after — ${at.post_activity.focus}`;
    }).join("\n");
    const rd = p.rest_day;
    protocolSection = `## ACTIVE PROTOCOL: ${protocolRow.name}
${p.description}

Activity types:
${atLines}

Rest day: carbs ${rd.carbs_g_per_kg.min}–${rd.carbs_g_per_kg.max}g/kg, protein ${rd.protein_g_per_kg.min}–${rd.protein_g_per_kg.max}g/kg, fat ${rd.fat_g_per_kg.min}–${rd.fat_g_per_kg.max}g/kg, offset ${rd.calorie_offset} kcal

Race week: ${p.race_week.strategy_notes}

Full protocol JSON (needed for proposed updates):
${JSON.stringify(p, null, 2)}`;
  } else {
    protocolSection = "## ACTIVE PROTOCOL\nNo active protocol set.";
  }

  // ── Strategy ──────────────────────────────────────────────────────────────
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

  // ── Upcoming week ─────────────────────────────────────────────────────────
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

  // ── Recent feedback ───────────────────────────────────────────────────────
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

  // ── Capabilities ──────────────────────────────────────────────────────────
  const capabilitiesSection = `## YOUR CAPABILITIES

You can:
1. Answer questions about nutrition, fuelling, training-related diet, the user's protocol, their shopping list, or general sports science
2. Modify the fuelling protocol — add/remove/tweak activity types, change macro targets, adjust fuelling rules
3. Modify the weekly shopping strategy — change the ingredient pool and shopping list

When modifying the PROTOCOL, output the COMPLETE updated protocol inside <protocol_update> tags:
<protocol_update>
{...full ProtocolFile JSON — must match the schema exactly, all fields required...}
</protocol_update>

When modifying the SHOPPING STRATEGY, output the update inside <strategy_update> tags:
<strategy_update>
{"ingredientPool":["item1","item2"],"shoppingItems":[{"item":"Chicken breast","category":"protein","amount":"1 kg"}]}
</strategy_update>

Rules:
- Only include update tags when actually making changes, not when answering questions
- Protocol updates: output the COMPLETE protocol with ALL activity types — no partial diffs
- Shopping updates: output the COMPLETE ingredient pool and shopping list
- Both updates can appear in the same response
- Keep responses concise and practical — you're talking to a cyclist, not writing a textbook
- Use UK English
- When making protocol changes that affect foods needed, mention the shopping list implications
- When making shopping changes, consider what the protocol's activity types require

${SCHEMAS}`;

  return `You are Cutta, an AI performance fuelling advisor for an endurance cyclist. You help with nutrition, fuelling protocols, shopping strategy, and training-related nutrition questions.

${profileSection}

${protocolSection}

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

  const [profileRows, protocolRows, strategyRows, eventRows, complianceRows, feedbackRows, weightRows] =
    await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, userId)).limit(1),

      db.select({ name: protocols.name, content: protocols.content })
        .from(protocols)
        .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
        .limit(1),

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
  const protocolRow = protocolRows[0] ?? null;
  const strategyRow = strategyRows[0] ?? null;

  let typedProtocol: { name: string; content: ProtocolFile } | null = null;
  if (protocolRow) {
    const c = protocolRow.content as Record<string, unknown>;
    const restDay = c.rest_day as Record<string, unknown> | undefined;
    if (typeof restDay?.calorie_offset === "number" && Array.isArray(c.activity_types)) {
      typedProtocol = { name: protocolRow.name, content: protocolRow.content as ProtocolFile };
    }
  }

  const latestWeightKg = weightRows[0]?.weightKg ? Number(weightRows[0].weightKg) : null;
  const timezone = (profile?.timezone as string | null) ?? "Europe/London";

  const systemPrompt = buildSystemPrompt({
    profile: profile as Record<string, unknown> | null,
    latestWeightKg,
    timezone,
    protocolRow: typedProtocol,
    strategyRow,
    upcomingEvents: eventRows,
    recentCompliance: complianceRows as { logDate: string; compliance: string }[],
    recentFeedback:   feedbackRows as { feedbackType: string; rating: number | null; planDate: string }[],
  });

  return NextResponse.json({ systemPrompt, userMessage: message.trim() });
}
