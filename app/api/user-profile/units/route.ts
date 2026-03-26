import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { unitSystem } = await req.json();
  if (unitSystem !== "metric" && unitSystem !== "imperial") {
    return NextResponse.json({ error: "Invalid unit system" }, { status: 400 });
  }

  await db
    .update(userProfiles)
    .set({ unitSystem, updatedAt: new Date() })
    .where(eq(userProfiles.clerkUserId, userId));

  return NextResponse.json({ ok: true, unitSystem });
}
