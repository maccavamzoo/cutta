import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { weeklyStrategies } from "@/lib/db/schema";
import { STRATEGY_TEMPLATES } from "@/lib/weekly-strategy-templates";

// ── GET — return the active strategy (or null) ────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(weeklyStrategies)
    .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
    .limit(1);

  const row = rows[0] ?? null;
  return NextResponse.json({ strategy: row });
}

// ── POST — create a new strategy from a template ──────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let templateIndex: number;
  try {
    const body = await req.json();
    templateIndex = body.templateIndex;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof templateIndex !== "number" ||
    templateIndex < 0 ||
    templateIndex >= STRATEGY_TEMPLATES.length
  ) {
    return NextResponse.json({ error: "Invalid templateIndex." }, { status: 400 });
  }

  const template = STRATEGY_TEMPLATES[templateIndex];
  const now = new Date();

  // Deactivate all existing strategies for this user
  await db
    .update(weeklyStrategies)
    .set({ isActive: false, updatedAt: now })
    .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)));

  // Insert new active strategy from template
  const [row] = await db
    .insert(weeklyStrategies)
    .values({
      clerkUserId:    userId,
      name:           template.name,
      weekOverview:   `${template.weekOverview.focus} (${template.weekOverview.trainingDays} training days)`,
      ingredientPool: template.ingredientPool,
      shoppingItems:  template.shoppingItems,
      proposedUpdate: null,
      aiReasoning:    null,
      isActive:       true,
      createdAt:      now,
      updatedAt:      now,
    })
    .returning();

  return NextResponse.json({ strategy: row }, { status: 201 });
}
