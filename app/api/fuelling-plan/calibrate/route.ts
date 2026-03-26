import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { fuellingPlans } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { planDate, glycogenBattery } = body;

  if (
    typeof planDate !== "string" ||
    typeof glycogenBattery !== "number" ||
    glycogenBattery < 0 ||
    glycogenBattery > 100
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await db
    .update(fuellingPlans)
    .set({ glycogenBattery: Math.round(glycogenBattery) })
    .where(
      and(
        eq(fuellingPlans.clerkUserId, userId),
        eq(fuellingPlans.planDate, planDate)
      )
    )
    .returning({ id: fuellingPlans.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Plan not found for that date" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, glycogenBattery: Math.round(glycogenBattery) });
}
