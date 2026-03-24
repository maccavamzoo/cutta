import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({ onboardingComplete: userProfiles.onboardingComplete })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (!profile?.onboardingComplete) redirect("/onboarding");

  // Main app shell — subsequent tasks will build this out
  return (
    <main className="flex min-h-[calc(100dvh-52px)] items-center justify-center bg-black px-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-white">Cutta</h1>
        <p className="text-zinc-400 text-sm">Your fuelling plan is coming.</p>
      </div>
    </main>
  );
}
