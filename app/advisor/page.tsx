import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import AdvisorView from "./AdvisorView";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default async function AdvisorPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({ advisorChatHistory: userProfiles.advisorChatHistory })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const initialChatHistory = Array.isArray(profile?.advisorChatHistory)
    ? (profile.advisorChatHistory as Message[])
    : [];

  return <AdvisorView initialChatHistory={initialChatHistory} />;
}
