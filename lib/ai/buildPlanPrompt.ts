import type { InferSelectModel } from "drizzle-orm";
import type {
  userProfiles,
  protocols,
  calendarEvents,
  trainingLog,
} from "@/lib/db/schema";

type UserProfile = InferSelectModel<typeof userProfiles>;
type Protocol    = InferSelectModel<typeof protocols>;
type CalEvent    = InferSelectModel<typeof calendarEvents>;
type TrainEntry  = InferSelectModel<typeof trainingLog>;

export interface DayPlanOutput {
  date: string;                      // YYYY-MM-DD
  day_type: "rest" | "training" | "race";
  calendar_event_id: number | null;
  glycogen_battery: number;          // 0–100
  total_calories: number;
  total_carbs_g: number;
  total_protein_g: number;
  total_fat_g: number;
  ai_reasoning: string;
  meals: {
    name: string;
    timing: string;
    ingredients: { item: string; grams: number }[];
  }[];
  on_bike_fuelling: {
    pre:     { description: string; timing: string; items: { item: string; amount: string }[] };
    on_bike: { carbs_per_hour: number; items: { item: string; amount: string }[] };
    post:    { description: string; timing: string; items: { item: string; amount: string }[] };
  } | null;
  supplements: { name: string; dose: string; timing: string }[];
}

export interface PlanGenerationResponse {
  plans: DayPlanOutput[];
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtEvent(e: CalEvent): string {
  const dt = new Date(e.scheduledAt);
  const timeStr = dt.toISOString().substring(11, 16); // HH:MM UTC
  const parts = [
    `  date: ${fmtDate(dt)}`,
    `  scheduled_time: ${timeStr} (use this to time meals correctly — pre-ride meal ~2-3h before, post-ride meal immediately after)`,
    `  id: ${e.id}`,
    `  title: ${e.title}`,
    `  type: ${e.eventType}`,
  ];
  if (e.durationMinutes) parts.push(`  duration: ${e.durationMinutes} min`);
  if (e.distanceKm)      parts.push(`  distance: ${e.distanceKm} km`);
  if (e.intensity)       parts.push(`  intensity: ${e.intensity}`);
  if (e.notes)           parts.push(`  notes: ${e.notes}`);
  return parts.join("\n");
}

function fmtTrainEntry(t: TrainEntry): string {
  const parts = [
    `  date: ${t.activityDate}`,
    `  source: ${t.source}`,
  ];
  if (t.durationMinutes)   parts.push(`  duration: ${t.durationMinutes} min`);
  if (t.distanceKm)        parts.push(`  distance: ${t.distanceKm} km`);
  if (t.avgPowerWatts)     parts.push(`  avg_power: ${t.avgPowerWatts} W`);
  if (t.avgHeartRate)      parts.push(`  avg_hr: ${t.avgHeartRate} bpm`);
  if (t.elevationM)        parts.push(`  elevation: ${t.elevationM} m`);
  if (t.estimatedCalories) parts.push(`  calories_burned: ${t.estimatedCalories} kcal`);
  return parts.join("\n");
}

export function buildPlanPrompt(
  profile: UserProfile,
  protocol: Protocol,
  events: CalEvent[],
  recentTraining: TrainEntry[],
  startDate: Date,
  days: number = 3,
): string {
  const startStr = fmtDate(startDate);
  const endDate  = new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
  const endStr   = fmtDate(endDate);

  // Build exact date list
  const planDates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    planDates.push(fmtDate(d));
  }

  const today = fmtDate(new Date());

  const foodProfile = profile.foodProfile as {
    positive?: string[];
    negative?: string[];
    gutTriggers?: string[];
    supplementReactions?: Record<string, string>;
  } | null;

  // ── Section 1: User profile ───────────────────────────────────────────────
  const profileSection = `
## USER PROFILE
- Current weight: ${profile.currentWeightKg ?? "unknown"} kg
- Target weight: ${profile.targetWeightKg ?? "unknown"} kg
- Height: ${profile.heightCm ?? "unknown"} cm
- Age: ${profile.age ?? "unknown"}
- Sex: ${profile.sex ?? "unknown"}
- Estimated maintenance calories: ${profile.estimatedMaintenanceCalories ?? "unknown"} kcal/day
- Usual carb intake: ${profile.usualCarbIntakeGrams ?? "unknown"} g/day
- Typical weekly training hours: ${profile.typicalWeeklyHours ?? "unknown"}
- Session types: ${profile.sessionTypes?.join(", ") || "unspecified"}
- Usual intensity: ${profile.usualIntensity ?? "unspecified"}
- Fasted training: ${profile.fastedTraining === true ? "yes" : profile.fastedTraining === false ? "no" : "sometimes"}
- Training time preference: ${profile.trainingTimePreference ?? "unspecified"}
- Training environment: ${profile.trainingEnvironment ?? "unspecified"}
- Gut sensitivity: ${profile.gutSensitivity || "none reported"}
- Food exclusions: ${profile.foodExclusions?.join(", ") || "none"}
- Current supplements: ${profile.currentSupplements?.join(", ") || "none"}
- Appetite profile: ${profile.appetiteProfile || "unspecified"}
- Preferred meal timing: ${profile.preferredMealTiming || "unspecified"}
${foodProfile?.positive?.length ? `- Preferred foods: ${foodProfile.positive.join(", ")}` : ""}
${foodProfile?.negative?.length ? `- Disliked foods: ${foodProfile.negative.join(", ")}` : ""}
${foodProfile?.gutTriggers?.length ? `- Known gut triggers: ${foodProfile.gutTriggers.join(", ")}` : ""}
`.trim();

  // ── Section 2: Active protocol ────────────────────────────────────────────
  const protocolSection = `
## ACTIVE FUELLING PROTOCOL: ${protocol.name}
${JSON.stringify(protocol.content, null, 2)}
`.trim();

  // ── Section 3: Training calendar for the window ───────────────────────────
  const eventsForWindow = events.filter((e) => {
    const d = fmtDate(new Date(e.scheduledAt));
    return d >= startStr && d <= endStr;
  });

  const calendarSection = eventsForWindow.length > 0
    ? `## TRAINING CALENDAR (${startStr} to ${endStr})\n${eventsForWindow.map(fmtEvent).join("\n\n")}`
    : `## TRAINING CALENDAR (${startStr} to ${endStr})\nNo sessions logged for this period — treat all days as rest.`;

  // ── Section 4: Recent training log ────────────────────────────────────────
  const recentSection = recentTraining.length > 0
    ? `## RECENT TRAINING LOG (last 7 days)\n${recentTraining.map(fmtTrainEntry).join("\n\n")}`
    : `## RECENT TRAINING LOG\nNo recent training data.`;

  // ── Section 5: Exact dates to generate ───────────────────────────────────
  const datesSection = `## DATES TO GENERATE (${days} days)\n${planDates.join(", ")}`;

  // ── Output format ─────────────────────────────────────────────────────────
  const formatSection = `
## REQUIRED OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no explanation, no extra text.
The object must have exactly one key "plans" containing an array of exactly ${days} objects, one per date in order.

Each object must have these exact keys:
{
  "date": "YYYY-MM-DD",
  "day_type": "rest" | "training" | "race",
  "calendar_event_id": <integer matching the calendar event id, or null>,
  "glycogen_battery": <integer 0-100>,
  "total_calories": <integer>,
  "total_carbs_g": <integer>,
  "total_protein_g": <integer>,
  "total_fat_g": <integer>,
  "ai_reasoning": "<1-2 sentence explanation of the day's plan logic>",
  "meals": [
    {
      "name": "<meal name e.g. 'Pre-ride oats'>",
      "timing": "<time or relative e.g. '07:00' or '2h before ride'>",
      "ingredients": [
        { "item": "<ingredient name>", "grams": <integer> }
      ]
    }
  ],
  "on_bike_fuelling": {
    "pre":     { "description": "<what to eat/drink>", "timing": "<when relative to ride>", "items": [{ "item": "<name>", "amount": "<e.g. 500ml>" }] },
    "on_bike": { "carbs_per_hour": <integer>, "items": [{ "item": "<name>", "amount": "<amount>" }] },
    "post":    { "description": "<what to eat/drink>", "timing": "<within X min>", "items": [{ "item": "<name>", "amount": "<amount>" }] }
  },
  "supplements": [
    { "name": "<supplement>", "dose": "<e.g. 2g>", "timing": "<e.g. with breakfast>" }
  ]
}

Rules:
- on_bike_fuelling must be null for rest days and days without a training/race event
- on_bike_fuelling must be populated for every training or race day
- meals: 2-4 entries per day; each meal 4-8 ingredients with gram weights
- CRITICAL: use scheduled_time to set meal timings. A 17:00 ride needs breakfast ~07:00, lunch ~12:00, pre-ride snack ~14:00, post-ride dinner ~19:30. An 07:00 ride needs pre-ride at ~05:30, post-ride breakfast ~09:00, lunch, dinner.
- meal "timing" field: use clock times (e.g. "07:00", "14:00") NOT vague labels like "breakfast" or "pre-ride"
- ai_reasoning: max 150 characters
- glycogen_battery: 20=depleted, 50=moderate, 80=well fuelled, 100=fully loaded
- supplements: only include current supplements from the profile
`.trim();

  return `You are Cutta, an AI performance fuelling system for endurance cyclists. Generate a precise, practical ${days}-day fuelling plan for this athlete.

RECOMMENDATION HIERARCHY (resolve conflicts in this order):
1. Health & performance guardrails: energy availability must not drop dangerously low; cap weight loss at protocol max_weekly_loss_kg; prevent RED-S
2. Training demands: session fuelling, glycogen replenishment, recovery nutrition
3. Protocol rules: follow the active protocol JSON exactly
4. Food tolerances: avoid known gut triggers and excluded foods
5. Preferences: use preferred foods where possible
6. Convenience: practical meals, realistic portions

Today is ${today}. Generate a plan for ${startStr} to ${endStr}.

${profileSection}

${protocolSection}

${calendarSection}

${recentSection}

${datesSection}

${formatSection}`;
}
