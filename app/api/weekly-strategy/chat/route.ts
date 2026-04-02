import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { weeklyStrategies } from "@/lib/db/schema";
import type { ShoppingItem } from "@/lib/weekly-strategy-templates";

export const maxDuration = 30;

const STRATEGY_SCHEMA = `
interface ShoppingItem {
  item:     string;  // ingredient name, e.g. "Rolled oats"
  category: string;  // one of: protein | carbs | fats | vegetables | dairy | supplements | other
  amount:   string;  // purchase quantity, e.g. "1 kg", "6 units", "2 cans"
}

interface WeeklyStrategy {
  ingredientPool: string[];   // short name strings used in meal plan generation
  shoppingItems:  ShoppingItem[];
}
`.trim();

function buildSystemPrompt(strategy: {
  name: string;
  weekOverview: string | null;
  ingredientPool: unknown;
  shoppingItems: unknown;
}): string {
  return `You are Cutta, a performance fuelling assistant for an endurance cyclist.
You are helping the user review and refine their weekly ingredient pool and shopping list.

CURRENT STRATEGY: ${strategy.name}
${strategy.weekOverview ? `Overview: ${strategy.weekOverview}` : ""}

CURRENT INGREDIENT POOL:
${(strategy.ingredientPool as string[]).map((i) => `- ${i}`).join("\n")}

CURRENT SHOPPING LIST:
${(strategy.shoppingItems as ShoppingItem[]).map((i) => `- ${i.item} (${i.category}) — ${i.amount}`).join("\n")}

SCHEMA:
${STRATEGY_SCHEMA}

INSTRUCTIONS:
- Answer questions about the strategy and nutrition concisely.
- If the user asks you to modify the ingredient pool or shopping list, propose the FULL updated strategy using a <strategy_update> block.
- The <strategy_update> block must contain valid JSON matching the WeeklyStrategy interface.
- Always include the complete lists in the update — do not emit partial patches.
- Do not change the strategy name or overview unless explicitly asked.
- Keep shopping amounts practical (weekly quantities for one person).
- Ingredient pool items should be short plain names (e.g. "white rice", not "cooked white rice").
- Always respond in plain text with the <strategy_update> block at the END of your message if proposing changes.

Example:
<strategy_update>
{"ingredientPool":["rolled oats","white rice"],"shoppingItems":[{"item":"Rolled oats","category":"carbs","amount":"1 kg"}]}
</strategy_update>`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let message: string;
  let history: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    message = body.message;
    history = body.history ?? [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  // Load active strategy
  const rows = await db
    .select()
    .from(weeklyStrategies)
    .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
    .limit(1);

  const strategy = rows[0];
  if (!strategy) {
    return NextResponse.json({ error: "No active strategy found." }, { status: 422 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history,
    { role: "user", content: message },
  ];

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system:     buildSystemPrompt(strategy),
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response." }, { status: 502 });
  }

  const aiText = block.text;

  // Extract proposed update if present
  const updateMatch = aiText.match(/<strategy_update>([\s\S]*?)<\/strategy_update>/);
  let proposedUpdate: { ingredientPool?: string[]; shoppingItems?: ShoppingItem[] } | null = null;

  if (updateMatch) {
    try {
      proposedUpdate = JSON.parse(updateMatch[1].trim()) as typeof proposedUpdate;
    } catch {
      // ignore malformed update
    }
  }

  // Store proposed update on the strategy row (user must confirm separately)
  if (proposedUpdate) {
    await db
      .update(weeklyStrategies)
      .set({ proposedUpdate, updatedAt: new Date() })
      .where(eq(weeklyStrategies.id, strategy.id));
  }

  // Strip the raw XML block from the displayed message
  const displayText = aiText
    .replace(/<strategy_update>[\s\S]*?<\/strategy_update>/g, "")
    .trim();

  return NextResponse.json({
    reply:           displayText,
    hasProposedUpdate: proposedUpdate !== null,
  });
}
