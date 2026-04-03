import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { weeklyStrategies, protocols } from "@/lib/db/schema";
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

interface ProtocolContext {
  name: string;
  activityTypes: Array<{ name: string; description: string; carbs_g_per_kg: { min: number; max: number }; during_activity: { carbs_per_hour: number; description: string } | null }>;
  restDay: { carbs_g_per_kg: { min: number; max: number }; protein_g_per_kg: { min: number; max: number }; fat_g_per_kg: { min: number; max: number } };
}

function buildSystemPrompt(
  strategy: { name: string; weekOverview: string | null; ingredientPool: unknown; shoppingItems: unknown },
  protocol: ProtocolContext | null,
): string {
  const protocolSection = protocol
    ? `## Active fuelling protocol: ${protocol.name}
Activity types defined:
${protocol.activityTypes.map((at) => {
  const carbs = `${at.carbs_g_per_kg.min}–${at.carbs_g_per_kg.max}g carbs/kg`;
  const during = at.during_activity
    ? at.during_activity.carbs_per_hour === 0
      ? "during-activity: water/electrolytes only"
      : `during-activity: ${at.during_activity.carbs_per_hour}g carbs/hr (${at.during_activity.description})`
    : "during-activity: none";
  return `- ${at.name}: ${at.description}, ${carbs}, ${during}`;
}).join("\n")}

Rest day: ${protocol.restDay.carbs_g_per_kg.min}–${protocol.restDay.carbs_g_per_kg.max}g carbs/kg, ${protocol.restDay.protein_g_per_kg.min}–${protocol.restDay.protein_g_per_kg.max}g protein/kg, ${protocol.restDay.fat_g_per_kg.min}–${protocol.restDay.fat_g_per_kg.max}g fat/kg

The shopping list should support the foods needed for these activity types. High-carb activity types need carb-dense staples (rice, pasta, oats, bread). Activity types with during-activity fuelling (gels, bars, drink mix) should have those in the shopping list. High-intensity days with protein recovery targets need adequate protein sources.`
    : `## Active fuelling protocol
No active protocol found. Suggest the user sets one up on the Settings > Protocol page so shopping can be tailored to their training types.`;

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

${protocolSection}

INSTRUCTIONS:
- Answer questions about the strategy and nutrition concisely.
- Reference the active protocol's activity types when relevant — e.g. if a Hard ride needs 60g carbs/hr during activity, the shopping list should cover gels or drink mix.
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

  // Load active strategy and active protocol in parallel
  const [strategyRows, protocolRows] = await Promise.all([
    db
      .select()
      .from(weeklyStrategies)
      .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
      .limit(1),
    db
      .select({ name: protocols.name, content: protocols.content })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
  ]);

  const strategy = strategyRows[0];
  if (!strategy) {
    return NextResponse.json({ error: "No active strategy found." }, { status: 422 });
  }

  // Extract protocol context if new-format protocol exists
  let protocolContext: ProtocolContext | null = null;
  const protocolRow = protocolRows[0];
  if (protocolRow) {
    const c = protocolRow.content as Record<string, unknown>;
    const restDay = c.rest_day as Record<string, unknown> | undefined;
    if (typeof restDay?.calorie_offset === "number" && Array.isArray(c.activity_types)) {
      protocolContext = {
        name: protocolRow.name,
        activityTypes: (c.activity_types as Array<Record<string, unknown>>)
          .filter((at) => typeof at.name === "string")
          .map((at) => ({
            name:           at.name as string,
            description:    (at.description as string) ?? "",
            carbs_g_per_kg: (at.carbs_g_per_kg as { min: number; max: number }) ?? { min: 0, max: 0 },
            during_activity: at.during_activity
              ? (at.during_activity as { carbs_per_hour: number; description: string })
              : null,
          })),
        restDay: {
          carbs_g_per_kg:   (restDay.carbs_g_per_kg   as { min: number; max: number }) ?? { min: 0, max: 0 },
          protein_g_per_kg: (restDay.protein_g_per_kg as { min: number; max: number }) ?? { min: 0, max: 0 },
          fat_g_per_kg:     (restDay.fat_g_per_kg     as { min: number; max: number }) ?? { min: 0, max: 0 },
        },
      };
    }
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
    system:     buildSystemPrompt(strategy, protocolContext),
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
