import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
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

interface DayMacros {
  calorie_offset: number;       // e.g. -400 means maintenance - 400 kcal
  add_training_burn: boolean;   // add training burn on top of offset
  carbs_g_per_kg: MacroRange;
  protein_g_per_kg: MacroRange;
  fat_g_per_kg: MacroRange;
}

interface PreRideRules {
  timing_hours_before: number;
  focus: string;
}

interface OnBikeRules {
  under_90min_carbs_per_hour: number;   // 0 means no carbs needed
  over_90min_carbs_per_hour: MacroRange;
  over_3hrs_carbs_per_hour: MacroRange;
}

interface PostRideRules {
  timing_minutes_after: number;
  focus: string;
  protein_g_per_kg: number;
  carbs_g_per_kg: number;
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
  rest_day: DayMacros;
  training_day: DayMacros;
  pre_ride: PreRideRules;
  on_bike: OnBikeRules;
  post_ride: PostRideRules;
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

  // Fetch active protocol
  const [active] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
    .limit(1);

  if (!active) {
    return NextResponse.json(
      { error: "No active protocol. Select one first." },
      { status: 400 }
    );
  }

  const protocolContent = active.content as ProtocolFile;

  const systemPrompt = `You are Cutta's protocol advisor. The user has a fuelling protocol that controls how their AI meal plans are generated.

The protocol follows this exact TypeScript schema:
${PROTOCOL_SCHEMA}

Key field explanations:
- calorie_offset: calories relative to maintenance (e.g. -400 = maintenance minus 400). Use 0 for maintenance.
- add_training_burn: if true, training calories are added on top of the offset
- MacroRange: { min, max } in g/kg body weight. Use same value for min and max when there's no range.
- under_90min_carbs_per_hour: use 0 to mean "water/electrolytes only"
- post_ride protein_g_per_kg and carbs_g_per_kg: grams per kg to consume within the recovery window
- race_week.strategy_notes: plain English strategy description

Current active protocol:
${JSON.stringify(protocolContent, null, 2)}

You can:
1. Answer questions about what the protocol contains and what it means for their nutrition
2. Suggest changes when asked — explain what you'd change and why

When the user asks you to make a change:
- Respond with a brief explanation of the change
- Then include the COMPLETE updated protocol JSON in a <protocol_update> tag like this:
<protocol_update>
{"protocol_name": "...", ...complete JSON...}
</protocol_update>
- The JSON inside the tag must be the FULL protocol with the change applied, not a partial diff
- The JSON must exactly match the ProtocolFile schema — do not add or rename fields
- Only include the <protocol_update> tag when actually making changes, not when just answering questions

Keep responses concise and practical. You're talking to a cyclist, not a nutritionist. Use plain language.`;

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
