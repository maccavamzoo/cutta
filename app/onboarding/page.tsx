import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import OnboardingForm from "./OnboardingForm";

export const metadata = {
  title: "Get started — Cutta",
};

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({ onboardingComplete: userProfiles.onboardingComplete })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (profile?.onboardingComplete) redirect("/");

  return <OnboardingForm />;
}
