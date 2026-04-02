import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { weeklyStrategies } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ShoppingView, { type WeeklyStrategy } from "./ShoppingView";
import { STRATEGY_TEMPLATES } from "@/lib/weekly-strategy-templates";

export default async function ShoppingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(weeklyStrategies)
    .where(and(eq(weeklyStrategies.clerkUserId, userId), eq(weeklyStrategies.isActive, true)))
    .limit(1);

  const row = rows[0] ?? null;

  const initialStrategy: WeeklyStrategy | null = row
    ? {
        id:             row.id,
        name:           row.name,
        weekOverview:   row.weekOverview,
        ingredientPool: row.ingredientPool as string[],
        shoppingItems:  row.shoppingItems as WeeklyStrategy["shoppingItems"],
        proposedUpdate: row.proposedUpdate as WeeklyStrategy["proposedUpdate"],
        aiReasoning:    row.aiReasoning,
      }
    : null;

  const templateNames = STRATEGY_TEMPLATES.map((t) => ({
    name:    t.name,
    focus:   t.weekOverview.focus,
    days:    t.weekOverview.trainingDays,
  }));

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <ShoppingView
            initialStrategy={initialStrategy}
            templateNames={templateNames}
          />
        </div>
      </main>
      <BottomNav active="more" />
    </>
  );
}
