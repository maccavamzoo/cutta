import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Shape of the JSON Claude returns
export interface ExtractionResult {
  fields: {
    duration_minutes:   { value: number | null; confidence: number };
    distance_km:        { value: number | null; confidence: number };
    avg_power_watts:    { value: number | null; confidence: number };
    avg_heart_rate:     { value: number | null; confidence: number };
    elevation_m:        { value: number | null; confidence: number };
    estimated_calories: { value: number | null; confidence: number };
  };
  overall_confidence: number;
  source_detected: string;
  notes: string;
}

// POST body: { imageBase64: string; mimeType: string }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageBase64: string; mimeType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;

  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { error: "imageBase64 and mimeType are required." },
      { status: 422 }
    );
  }

  const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!validMimeTypes.includes(mimeType)) {
    return NextResponse.json(
      { error: "mimeType must be image/jpeg, image/png, image/gif, or image/webp." },
      { status: 422 }
    );
  }

  const prompt = `Extract training data from this screenshot. It could be from any cycling app or platform — Strava, Rouvy, Garmin, Wahoo, Zwift, TrainerRoad, or any other source. Extract whatever data you can identify.

Return ONLY valid JSON in exactly this format — no markdown, no explanation, just the JSON object:

{
  "fields": {
    "duration_minutes": { "value": <integer or null>, "confidence": <0-100> },
    "distance_km": { "value": <number with 1 decimal or null>, "confidence": <0-100> },
    "avg_power_watts": { "value": <integer or null>, "confidence": <0-100> },
    "avg_heart_rate": { "value": <integer or null>, "confidence": <0-100> },
    "elevation_m": { "value": <integer or null>, "confidence": <0-100> },
    "estimated_calories": { "value": <integer or null>, "confidence": <0-100> }
  },
  "overall_confidence": <0-100>,
  "source_detected": "<name of the app/platform detected, or 'unknown'>",
  "notes": "<brief note about what you can and cannot see>"
}

Field rules:
- duration_minutes: total moving or elapsed time converted to integer minutes
- distance_km: distance in km (convert miles to km if needed: miles × 1.609)
- avg_power_watts: average power in watts
- avg_heart_rate: average heart rate in bpm
- elevation_m: total elevation gain in metres (convert feet if needed: feet × 0.305)
- estimated_calories: calories burned (often labelled kcal or Cal)
- Use null when a field is not visible or cannot be reliably read
- confidence: 90-100 = clearly visible and readable, 70-89 = visible but partially obscured, 50-69 = inferred or uncertain, 0-49 = guessed or very unclear`;

  const client = new Anthropic();
  let extraction: ExtractionResult;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Strip any accidental markdown fences
    const jsonText = raw.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    extraction = JSON.parse(jsonText) as ExtractionResult;
  } catch (err) {
    console.error("Claude extraction error:", err);
    return NextResponse.json(
      { error: "AI extraction failed. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ extraction });
}
