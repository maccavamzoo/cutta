import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userActivityTypes } from "@/lib/db/schema";

// GET — list all activity types for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(userActivityTypes)
    .where(eq(userActivityTypes.clerkUserId, userId))
    .orderBy(userActivityTypes.sortOrder);

  return NextResponse.json(rows);
}

// POST — create a new activity type
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Get max sort_order so new item goes at end
  const existing = await db
    .select({ sortOrder: userActivityTypes.sortOrder })
    .from(userActivityTypes)
    .where(eq(userActivityTypes.clerkUserId, userId))
    .orderBy(userActivityTypes.sortOrder);

  const maxSort = existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) : -1;

  const [row] = await db
    .insert(userActivityTypes)
    .values({
      clerkUserId:           userId,
      name:                  body.name.trim(),
      description:           body.description ?? "",
      burnRateKcalPerMin:    body.burnRateKcalPerMin != null ? String(body.burnRateKcalPerMin) : "8",
      carbsGPerKg:           body.carbsGPerKg != null ? String(body.carbsGPerKg) : "5",
      proteinGPerKg:         body.proteinGPerKg != null ? String(body.proteinGPerKg) : "1.8",
      preActivity:           body.preActivity ?? { timing_hours_before: 2, focus: "Moderate carbs, low fibre" },
      duringActivity:        body.duringActivity !== undefined ? body.duringActivity : { carbs_per_hour: 40, description: "Drink mix or gels" },
      postActivity:          body.postActivity ?? { timing_minutes_after: 30, focus: "Protein and carbs for recovery", protein_g_per_kg: 0.3, carbs_g_per_kg: 0.8 },
      defaultDurationMinutes: body.defaultDurationMinutes ?? 60,
      isRace:                body.isRace ?? false,
      sortOrder:             maxSort + 1,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
