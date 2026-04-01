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
      { error: "No active protocol. Select or upload one first." },
      { status: 400 }
    );
  }

  const protocolContent = active.content as ProtocolFile;

  const systemPrompt = `You are Cutta's protocol advisor. The user has a fuelling protocol (JSON) that controls how their AI meal plans are generated.

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
