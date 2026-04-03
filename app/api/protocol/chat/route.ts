import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { protocols, weeklyStrategies } from "@/lib/db/schema";
import { ProtocolFile, validateProtocol } from "@/lib/protocol";

export const maxDuration = 30;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
}

const PROTOCOL_SCHEMA = `
interface MacroRange { min: number; max: number; }

interface DuringActivityRules {
  carbs_per_hour: number;   // 0 means water/electrolytes only
  description: string;      // e.g. "60g carbs per hour — gels, bars, or drink mix"
}

interface ActivityPreRules {
  timing_hours_before: number;
  focus: string;  // e.g. "High carb, low fibre, moderate protein"
}

interface ActivityPostRules {
  timing_minutes_after: number;
  focus: string;
  protein_g_per_kg: number;  // grams per kg body weight
  carbs_g_per_kg: number;    // grams per kg body weight
}

interface ActivityType {
  name: string;                   // e.g. "Hard ride", "Easy ride", "Long ride", "Race", "S&C / Gym", "Run"
  description: string;            // short UI description
  calorie_offset: number;         // offset from maintenance, e.g. -200
  add_training_burn: boolean;     // add estimated training burn on top of offset
  burn_rate_kcal_per_min: number; // estimated kcal per minute for this activity
  carbs_g_per_kg: MacroRange;
  protein_g_per_kg: MacroRange;
  fat_g_per_kg: MacroRange;
  pre_activity: ActivityPreRules;
  during_activity: DuringActivityRules | null;  // null for gym/short activities
  post_activity: ActivityPostRules;
  default_duration_minutes: number;
  is_race: boolean;
}

interface RestDayRules {
  calorie_offset: number;
  carbs_g_per_kg: MacroRange;
  protein_g_per_kg: MacroRange;
  fat_g_per_kg: MacroRange;
}

interface RaceWeekRules {
  carb_load_days_before: number;
  carb_load_g_per_kg: MacroRange;
  race_morning_carbs_g_per_kg: number;
  race_morning_hours_before: number;
  strategy_notes: string;
}

interface ProtocolFile {
  protocol_name: string;
  description: string;
  rest_day: RestDayRules;
  activity_types: ActivityType[];   // at least 1 entry required
  race_week: RaceWeekRules;
}
`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, conversationHistory } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  // Fetch active protocol and active weekly strategy in parallel
  const [[active], [strategyRow]] = await Promise.all([
    db
      .select()
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
    db
      .select({ name: weeklyStrategies.name, ingredientPool: weeklyStrategies.ingredientPool })
      .from(weeklyStrategies)
      .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
      .limit(1),
  ]);

  if (!active) {
    return NextResponse.json(
      { error: "No active protocol. Select one first." },
      { status: 400 }
    );
  }

  const protocolContent = active.content as ProtocolFile;

  const shoppingSection = strategyRow
    ? `## Current weekly shopping strategy: ${strategyRow.name}
Ingredient pool: ${(strategyRow.ingredientPool as string[]).join(", ")}

The user has these ingredients available this week. If you make protocol changes that affect what foods are needed (e.g. adding a new activity type, changing macro targets significantly, adding during-activity fuelling), let the user know they may want to update their shopping list too.`
    : `## Current weekly shopping strategy
No weekly shopping strategy set. If the user asks about food or ingredients, suggest they set one up on the Shopping page.`;

  const systemPrompt = `You are Cutta's protocol advisor. The user has a fuelling protocol that controls how their AI meal plans are generated.

The protocol follows this exact TypeScript schema:
${PROTOCOL_SCHEMA}

Key field explanations:
- activity_types: array of activity types — each is a complete nutrition profile for that kind of session
- Standard activity type names (keep consistent): "Hard ride", "Easy ride", "Long ride", "Race", "S&C / Gym", "Run"
- calorie_offset: offset from maintenance (e.g. -200 = maintenance minus 200 kcal). Use 0 for no deficit.
- add_training_burn: if true, estimated training calories are added on top of the offset
- burn_rate_kcal_per_min: estimated kcal per minute — used to calculate training burn
- MacroRange: { min, max } in g/kg body weight. Use same value for min and max when there's no range.
- during_activity: null for activities with no on-the-go fuelling (gym, short runs). Set carbs_per_hour: 0 for "water only".
- post_activity protein_g_per_kg and carbs_g_per_kg: grams per kg to consume within the recovery window
- rest_day has no add_training_burn field (it's always false for rest)
- race_week.strategy_notes: plain English strategy description

Current active protocol:
${JSON.stringify(protocolContent, null, 2)}

You can:
1. Answer questions about what the protocol contains and what it means for their nutrition
2. Suggest changes when asked — explain what you'd change and why
3. Add new activity types ("add a turbo session type")
4. Modify existing ones ("make my hard rides 70g carbs per hour")
5. Remove activity types ("I don't run, remove it")

When the user asks you to make a change:
- Respond with a brief explanation of the change
- Then include the COMPLETE updated protocol JSON in a <protocol_update> tag like this:
<protocol_update>
{"protocol_name": "...", ...complete JSON...}
</protocol_update>
- The JSON inside the tag must be the FULL protocol with ALL activity_types included, not a partial diff
- The JSON must exactly match the ProtocolFile schema — do not add or rename fields
- Only include the <protocol_update> tag when actually making changes, not when just answering questions

Keep responses concise and practical. You're talking to a cyclist, not a nutritionist. Use plain language.

${shoppingSection}`;

  // Instantiate SDK inside handler (project constraint)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawReply: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message.trim() },
      ],
    });

    const block = response.content[0];
    rawReply = block.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[protocol/chat] Anthropic error:", err);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 500 }
    );
  }

  // Parse <protocol_update> block
  const updateMatch = rawReply.match(/<protocol_update>([\s\S]*?)<\/protocol_update>/);
  let proposedUpdate: ProtocolFile | null = null;
  let validationError: string | null = null;

  if (updateMatch) {
    try {
      const parsed = JSON.parse(updateMatch[1].trim());
      const result = validateProtocol(parsed);
      if (result.valid) {
        proposedUpdate = result.data;
      } else {
        validationError = result.error;
      }
    } catch {
      validationError = "AI returned invalid JSON in the update block.";
    }
  }

  // Strip <protocol_update> block from reply text
  const reply = rawReply.replace(/<protocol_update>[\s\S]*?<\/protocol_update>/g, "").trim();

  return NextResponse.json({ reply, proposedUpdate, validationError });
}
