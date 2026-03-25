import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { shoppingLists } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ShoppingView, { type ShoppingList } from "./ShoppingView";

export default async function ShoppingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.clerkUserId, userId))
    .orderBy(desc(shoppingLists.generatedAt))
    .limit(1);

  const row = rows[0] ?? null;

  const initialList: ShoppingList | null = row
    ? {
        id:                row.id,
        generatedForStart: row.generatedForStart,
        generatedForEnd:   row.generatedForEnd,
        generatedAt:       row.generatedAt.toISOString(),
        items:             row.items as ShoppingList["items"],
      }
    : null;

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Shopping list</h1>
            <p className="text-zinc-500 text-sm mt-1">
              3-day ingredient list from your fuelling plan.
            </p>
          </div>

          <ShoppingView initialList={initialList} />
        </div>
      </main>

      <BottomNav active="shop" />
    </>
  );
}
