import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import FoodPreferencesView from "./FoodPreferencesView";

export const metadata = {
  title: "Gut health & food — Cutta",
};

export default async function FoodPreferencesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({
      trackStoolHealth:   userProfiles.trackStoolHealth,
      foodExclusions:     userProfiles.foodExclusions,
      preferredFoods:     userProfiles.preferredFoods,
      currentSupplements: userProfiles.currentSupplements,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (!profile) redirect("/onboarding");

  const initial = {
    trackStoolHealth:   profile.trackStoolHealth   ?? false,
    foodExclusions:     profile.foodExclusions      ?? [],
    preferredFoods:     profile.preferredFoods      ?? [],
    currentSupplements: profile.currentSupplements  ?? [],
  };

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto pb-24">
      <FoodPreferencesView initial={initial} backHref="/settings" />
    </main>
  );
}
