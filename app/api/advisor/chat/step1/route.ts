import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STEP1_SYSTEM = `You are Cutta, an AI performance fuelling advisor for an endurance cyclist.

The following data is available for you to request:
- Profile: body stats, weight goal, eating style, food exclusions
- Protocol: active fuelling protocol with macro targets and activity rules
- Shopping: weekly ingredient pool and shopping list
- Calendar: upcoming 7 days of training events
- Feedback: recent compliance check-ins and ride/gut/hunger ratings
- Weight: latest weigh-in data

Respond with a JSON object only — no other text:
{
  "holdingMessage": "A short, natural message to the user explaining what you're looking up (1-2 sentences, conversational, UK English)",
  "requestedData": ["Protocol", "Calendar"]
}

requestedData must only contain items from the available list above. Only request what you genuinely need to answer the question. If the question is simple and needs no data, set requestedData to an empty array and answer directly in holdingMessage.`;

const FALLBACK = {
  holdingMessage: "Bear with me…",
  requestedData: ["Profile", "Protocol", "Calendar", "Feedback", "Weight", "Shopping"],
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { message: string; conversationHistory: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, conversationHistory } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw = "";
  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 300,
      system:     STEP1_SYSTEM,
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: message.trim() },
      ],
    });
    const block = response.content[0];
    raw = block.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[advisor/chat/step1] Anthropic error:", err);
    return NextResponse.json({ ...FALLBACK, step1SystemPrompt: STEP1_SYSTEM });
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned) as { holdingMessage: string; requestedData: string[] };
    return NextResponse.json({ holdingMessage: parsed.holdingMessage, requestedData: parsed.requestedData, step1SystemPrompt: STEP1_SYSTEM });
  } catch {
    return NextResponse.json({ ...FALLBACK, step1SystemPrompt: STEP1_SYSTEM });
  }
}
