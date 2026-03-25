import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { fuellingPlans, shoppingLists } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Category keyword map — order matters (first match wins)
// ---------------------------------------------------------------------------
const CATEGORY_MAP: [string, string[]][] = [
  ["Supplements", [
    "gel", "bar", "electrolyte", "protein powder", "whey", "creatine",
    "caffeine", "beta-alanine", "isotonic", "sports drink", "energy chew",
    "recovery drink", "magnesium", "vitamin", "collagen",
  ]],
  ["Protein", [
    "chicken", "turkey", "beef", "mince", "steak", "salmon", "tuna", "cod",
    "haddock", "trout", "prawn", "shrimp", "ham", "pork", "bacon",
    "egg", "eggs", "cottage cheese", "greek yogurt", "tofu", "tempeh",
    "edamame", "quorn",
  ]],
  ["Carbs", [
    "rice", "pasta", "bread", "oat", "oats", "potato", "sweet potato",
    "bagel", "wrap", "tortilla", "cereal", "granola", "muesli", "noodle",
    "couscous", "quinoa", "lentil", "bean", "chickpea", "pitta", "roll",
    "crackers", "crispbread", "sourdough",
  ]],
  ["Fruit & Veg", [
    "banana", "apple", "berry", "berries", "blueberry", "strawberry",
    "raspberry", "orange", "mango", "grape", "melon", "pear", "kiwi",
    "spinach", "broccoli", "carrot", "courgette", "pepper", "tomato",
    "cucumber", "lettuce", "kale", "rocket", "pea", "corn", "onion",
    "garlic", "leek", "celery", "asparagus", "mushroom", "aubergine",
  ]],
  ["Dairy", [
    "milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "cheddar",
    "mozzarella", "parmesan", "feta", "ricotta",
  ]],
  ["Fats & Oils", [
    "olive oil", "coconut oil", "peanut butter", "almond butter", "nut butter",
    "almonds", "walnuts", "cashews", "pecans", "peanuts", "seeds",
    "flaxseed", "chia", "hemp seed", "tahini",
  ]],
];

function categorise(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  for (const [cat, keywords] of CATEGORY_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "Other";
}

// ---------------------------------------------------------------------------
// POST — generate a shopping list from the next 3 days of fuelling plans
// ---------------------------------------------------------------------------
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Window: today → today + 2 (3 days inclusive)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(todayStart.getTime() + 2 * 86_400_000);

  const startStr = todayStart.toISOString().split("T")[0];
  const endStr   = endDate.toISOString().split("T")[0];

  // Fetch plans for the window
  const plans = await db
    .select({ meals: fuellingPlans.meals, planDate: fuellingPlans.planDate })
    .from(fuellingPlans)
    .where(
      and(
        eq(fuellingPlans.clerkUserId, userId),
        gte(fuellingPlans.planDate, startStr),
        lte(fuellingPlans.planDate, endStr)
      )
    );

  if (plans.length === 0) {
    return NextResponse.json(
      { error: "No fuelling plans found for the next 3 days. Generate your plan first." },
      { status: 422 }
    );
  }

  // Aggregate ingredients — map of normalized name → { totalGrams, category }
  const aggregated = new Map<string, { display: string; totalGrams: number; category: string }>();

  for (const plan of plans) {
    const meals = plan.meals as {
      name: string;
      timing: string;
      ingredients: { item: string; grams: number }[];
    }[];

    for (const meal of meals ?? []) {
      for (const ing of meal.ingredients ?? []) {
        const key = ing.item.trim().toLowerCase();
        const existing = aggregated.get(key);
        if (existing) {
          existing.totalGrams += ing.grams ?? 0;
        } else {
          aggregated.set(key, {
            display:    ing.item.trim(),
            totalGrams: ing.grams ?? 0,
            category:   categorise(ing.item),
          });
        }
      }
    }
  }

  // Build items array sorted by category then name
  const items = Array.from(aggregated.values()).sort((a, b) => {
    if (a.category < b.category) return -1;
    if (a.category > b.category) return 1;
    return a.display.localeCompare(b.display);
  });

  // Save to shopping_lists table
  const [saved] = await db
    .insert(shoppingLists)
    .values({
      clerkUserId:       userId,
      generatedForStart: startStr,
      generatedForEnd:   endStr,
      items,
    })
    .returning();

  return NextResponse.json({ list: saved });
}

// ---------------------------------------------------------------------------
// GET — return the most recently generated shopping list
// ---------------------------------------------------------------------------
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.clerkUserId, userId))
    .orderBy(desc(shoppingLists.generatedAt))
    .limit(1);

  return NextResponse.json({ list: rows[0] ?? null });
}
