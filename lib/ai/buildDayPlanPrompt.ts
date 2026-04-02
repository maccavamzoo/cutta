import type { DayBrief } from '../plan-engine';

// ─── Output types ─────────────────────────────────────────────────────────────

// Shape of the AI's JSON response for a single day.
export interface SingleDayPlanOutput {
  meals: {
    name: string;
    timing: string;
    cooking_note: string;
    ingredients: { item: string; grams: number }[];
  }[];
  on_bike_fuelling: {
    pre:     { description: string; timing: string; items: { item: string; amount: string }[] };
    on_bike: { carbs_per_hour: number; items: { item: string; amount: string }[] };
    post:    { description: string; timing: string; items: { item: string; amount: string }[] };
  } | null;
  supplements: { name: string; dose: string; timing: string }[];
  ai_reasoning: string;
}

// Full plan shape used by PlanView and DailyDashboard (meals/fuelling/supplements sub-types).
// These components will be fully reworked in Phase 5 — kept for now to avoid breaking changes.
export interface DayPlanOutput {
  meals:            SingleDayPlanOutput['meals'];
  on_bike_fuelling: SingleDayPlanOutput['on_bike_fuelling'];
  supplements:      SingleDayPlanOutput['supplements'];
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildDayPlanPrompt(brief: DayBrief): string {
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  lines.push(
    'You are Cutta, a performance fuelling assistant for an endurance cyclist. ' +
    'Design meals for one day that hit the exact targets below.'
  );
  lines.push('');

  // ── Today section ──────────────────────────────────────────────────────────
  lines.push(`## TODAY: ${brief.date} (${brief.dayType} day)`);
  if (brief.trainingEvent) {
    const ev = brief.trainingEvent;
    const time = new Date(ev.scheduledAt).toISOString().substring(11, 16);
    lines.push(`Training: ${ev.title} at ${time} — ${ev.durationMinutes}min, ${ev.intensity}`);
  } else {
    lines.push('Rest day — no training');
  }
  if (brief.carbLoadContext) {
    lines.push(brief.carbLoadContext);
  }
  lines.push('');

  // ── Targets section ────────────────────────────────────────────────────────
  lines.push('## TARGETS (non-negotiable)');
  lines.push(
    `Total: ${brief.totalCalories} kcal | ${brief.totalCarbsG}g carbs | ` +
    `${brief.totalProteinG}g protein | ${brief.totalFatG}g fat`
  );
  lines.push('');
  lines.push('How these were calculated:');
  lines.push(`- Maintenance: ${brief.calorieBreakdown.maintenance} kcal`);
  if (brief.calorieBreakdown.trainingBurn > 0) {
    lines.push(`- Training burn: +${brief.calorieBreakdown.trainingBurn} kcal`);
  }
  lines.push(`- Protocol offset: ${brief.calorieBreakdown.calorieOffset} kcal`);
  if (brief.calorieBreakdown.guardrailAdjustment !== 0) {
    lines.push(`- Guardrail adjustments: ${brief.calorieBreakdown.guardrailAdjustment > 0 ? '+' : ''}${brief.calorieBreakdown.guardrailAdjustment} kcal`);
  }
  if (brief.guardrails.length > 0) {
    for (const g of brief.guardrails) {
      lines.push(`  • ${g.description}`);
    }
  }
  lines.push('');

  // ── Meal slots section ─────────────────────────────────────────────────────
  lines.push('## MEAL SLOTS');
  for (const slot of brief.mealSlots) {
    lines.push(
      `- ${slot.name} at ${slot.timing} (${slot.purpose}): ` +
      `${slot.calorieTarget} kcal | ${slot.carbsG}g C | ${slot.proteinG}g P | ${slot.fatG}g F`
    );
  }
  lines.push('');

  // ── On-bike fuelling section ────────────────────────────────────────────────
  if (brief.onBikeFuelling) {
    const ob = brief.onBikeFuelling;
    lines.push('## ON-BIKE FUELLING');
    lines.push(`- Pre-ride: ${ob.preRide.timing} — ${ob.preRide.focus}`);
    lines.push(
      `- During ride: ${ob.carbsPerHour}g carbs/hr for ${ob.durationMinutes}min ` +
      `(${ob.totalOnBikeCarbsG}g total)`
    );
    lines.push(
      `- Post-ride: ${ob.postRide.timing} — ${ob.postRide.proteinG}g protein + ` +
      `${ob.postRide.carbsG}g carbs — ${ob.postRide.focus}`
    );
    lines.push('');
  }

  // ── Food rules section ─────────────────────────────────────────────────────
  lines.push('## FOOD RULES');
  lines.push(`- Exclude: ${brief.foodExclusions.length > 0 ? brief.foodExclusions.join(', ') : 'none'}`);
  lines.push(`- Gut triggers (avoid): ${brief.gutTriggers.length > 0 ? brief.gutTriggers.join(', ') : 'none'}`);
  lines.push(`- Gut sensitivity: ${brief.gutSensitivity ?? 'normal'}`);
  lines.push(`- Preferred foods: ${brief.foodPreferences.length > 0 ? brief.foodPreferences.join(', ') : 'no specific preferences'}`);
  lines.push(`- Supplements to schedule: ${brief.currentSupplements.length > 0 ? brief.currentSupplements.join(', ') : 'none'}`);
  lines.push(`- Eating style: ${brief.appetiteProfile ?? 'no preference'}`);
  if (brief.ingredientPool && brief.ingredientPool.length > 0) {
    lines.push(`- Preferred ingredient pool (draw from these where possible): ${brief.ingredientPool.join(', ')}`);
  }
  if (brief.yesterdayMeals.length > 0) {
    lines.push(`- Yesterday's meals (avoid repeating): ${brief.yesterdayMeals.join(', ')}`);
  }
  lines.push('');

  // ── Output format ──────────────────────────────────────────────────────────
  lines.push('## OUTPUT FORMAT');
  lines.push('Return ONLY valid JSON — no markdown fences, no explanation.');
  lines.push('');
  lines.push(JSON.stringify({
    meals: [
      {
        name: '<meal name, e.g. \'Porridge with banana and honey\'>',
        timing: '<clock time from the meal slot, e.g. \'07:30\'>',
        cooking_note: '<one-line prep instruction, max 100 chars>',
        ingredients: [{ item: '<ingredient>', grams: 0 }],
      },
    ],
    on_bike_fuelling: brief.onBikeFuelling ? {
      pre: { description: '<what to eat/drink>', timing: '<from pre-ride brief>', items: [{ item: '<name>', amount: '<e.g. 500ml>' }] },
      on_bike: { carbs_per_hour: brief.onBikeFuelling.carbsPerHour, items: [{ item: '<name>', amount: '<amount>' }] },
      post: { description: '<what to eat/drink>', timing: '<from post-ride brief>', items: [{ item: '<name>', amount: '<amount>' }] },
    } : null,
    supplements: [{ name: '<from supplements list>', dose: '<e.g. 5g>', timing: '<e.g. with breakfast>' }],
    ai_reasoning: '<1 sentence explaining the day\'s approach, max 150 chars>',
  }, null, 2));
  lines.push('');
  lines.push('Rules:');
  lines.push(`- One meal object per meal slot, in the same order (${brief.mealSlots.length} meals)`);
  lines.push('- Each meal: 3-8 ingredients with gram weights');
  lines.push('- cooking_note: required, one concise sentence, practical prep instruction');
  lines.push('- Ingredient gram weights MUST sum to roughly match the per-meal macro targets (within 10%)');
  lines.push(`- on_bike_fuelling: ${brief.onBikeFuelling ? 'required for this training day' : 'null (rest day)'}`);
  lines.push('- supplements: only from the provided list, assign sensible timing');
  lines.push('- ai_reasoning: brief, e.g. "Rest day deficit with high protein to preserve muscle"');
  lines.push('- Do NOT recalculate or override any targets — use them exactly as given');

  return lines.join('\n');
}
