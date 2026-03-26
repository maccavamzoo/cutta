import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioNotes } from "@/lib/db/schema";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// POST — transcribe + structure a voice note, save to audio_notes
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let transcript: string;

  try {
    const body = await req.json();
    transcript = (body.transcript ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  // Insert a pending row immediately so the user gets instant feedback
  const [inserted] = await db
    .insert(audioNotes)
    .values({
      clerkUserId:      userId,
      transcript,
      processingStatus: "processing",
    })
    .returning();

  // Structure the transcript with Claude
  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a performance-nutrition assistant for an endurance cyclist.
A user has recorded a voice note. Extract structured information from the transcript below.

Return ONLY valid JSON — no markdown, no prose — matching exactly this shape:
{
  "summary": "1–2 sentence plain-English summary",
  "tags": ["array", "of", "short", "topic", "tags"],
  "energy_level": "low" | "moderate" | "high" | null,
  "gut_comfort": 1–5 integer (1=very bad, 5=great) | null,
  "symptoms": ["bloating", "cramping", "nausea", etc.],
  "foods_mentioned": ["specific foods", "supplements", "drinks"],
  "sentiment": "positive" | "neutral" | "negative",
  "action_items": ["brief action to take, e.g. 'Avoid gels on long rides'"],
  "plan_impact": "one sentence explaining how this note will affect the fuelling plan, or 'No plan impact — observation logged' if nothing actionable"
}

Rules:
- Only include fields you can infer from the transcript — set others to null or []
- tags should be concise keywords: energy, gut, recovery, sleep, food, hydration, ride, weight, mood, etc.
- action_items should be specific and actionable for a fuelling/training context
- plan_impact must always be a non-empty string. Examples:
    "Wheat flagged as potential gut trigger — will be avoided in upcoming meal plans"
    "Low energy reported post-ride — pre-ride carb timing will be reviewed in next plan"
    "Bloating noted after gel use — alternative on-bike fuelling will be suggested"
    "No plan impact — observation logged"
- If nothing relevant to sports nutrition is mentioned, still return the schema with empty arrays and null values

Transcript:
"""
${transcript}
"""`,
        },
      ],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const processedData = JSON.parse(raw);

    await db
      .update(audioNotes)
      .set({ processedData, processingStatus: "done" })
      .where(eq(audioNotes.id, inserted.id));

    return NextResponse.json({ id: inserted.id, transcript, processedData });
  } catch (err) {
    console.error("[audio-notes] structuring failed:", err);
    await db
      .update(audioNotes)
      .set({ processingStatus: "failed" })
      .where(eq(audioNotes.id, inserted.id));
    return NextResponse.json({ id: inserted.id, transcript, processedData: null });
  }
}

// ---------------------------------------------------------------------------
// GET — list recent audio notes
// ---------------------------------------------------------------------------
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await db
    .select()
    .from(audioNotes)
    .where(eq(audioNotes.clerkUserId, userId))
    .orderBy(desc(audioNotes.recordedAt))
    .limit(20);

  return NextResponse.json({ notes: rows });
}
