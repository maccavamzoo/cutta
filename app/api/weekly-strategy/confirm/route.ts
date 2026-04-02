import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { weeklyStrategies } from "@/lib/db/schema";
import type { ShoppingItem } from "@/lib/weekly-strategy-templates";

// POST — apply the pending proposedUpdate to the active strategy

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(weeklyStrategies)
    .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
    .limit(1);

  const strategy = rows[0];
  if (!strategy) {
    return NextResponse.json({ error: "No active strategy found." }, { status: 422 });
  }

  const proposed = strategy.proposedUpdate as {
    ingredientPool?: string[];
    shoppingItems?: ShoppingItem[];
  } | null;

  if (!proposed) {
    return NextResponse.json({ error: "No pending update to confirm." }, { status: 422 });
  }

  const now = new Date();
  const [updated] = await db
    .update(weeklyStrategies)
    .set({
      ingredientPool: proposed.ingredientPool ?? strategy.ingredientPool,
      shoppingItems:  proposed.shoppingItems  ?? strategy.shoppingItems,
      proposedUpdate: null,
      updatedAt:      now,
    })
    .where(eq(weeklyStrategies.id, strategy.id))
    .returning();

  return NextResponse.json({ strategy: updated });
}
