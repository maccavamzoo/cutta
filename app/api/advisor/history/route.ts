import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let chatHistory: Message[];
  try {
    const body = await req.json() as { chatHistory: unknown };
    if (!Array.isArray(body.chatHistory)) {
      return NextResponse.json({ error: "chatHistory must be an array." }, { status: 400 });
    }
    chatHistory = body.chatHistory as Message[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await db
    .update(userProfiles)
    .set({ advisorChatHistory: chatHistory })
    .where(eq(userProfiles.clerkUserId, userId));

  return NextResponse.json({ ok: true });
}
