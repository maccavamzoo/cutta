// Plan pre-computation engine.
// Pure deterministic module — no AI calls, no DB calls, no side effects.
// Takes user data + protocol and produces a complete DayBrief for one day.

import type { ProtocolFile, MacroRange, ActivityType } from './protocol';

// ─── resolveActivityType ─────────────────────────────────────────────────────
// Maps a calendar event's eventType string to an ActivityType from the protocol.
// Handles both new-style names ("Hard ride") and old-style values ("ride","race").

export function resolveActivityType(
  protocol: ProtocolFile,
  eventTypeName: string,
): ActivityType | null {
  if (eventTypeName === 'rest') return null;

  // Exact match first
  const exact = protocol.activity_types.find(at => at.name === eventTypeName);
  if (exact) return exact;

  // Fallback for old event type values
  const lower = eventTypeName.toLowerCase();
  if (lower === 'race') {
    return protocol.activity_types.find(at => at.is_race)
      ?? protocol.activity_types[0];
  }
  if (lower === 'ride') {
    return protocol.activity_types.find(at => at.name.toLowerCase().includes('easy') && !at.is_race)
      ?? protocol.activity_types.find(at => !at.is_race)
      ?? protocol.activity_types[0];
  }

  // Any other unrecognised type → first non-race
  return protocol.activity_types.find(at => !at.is_race) ?? protocol.activity_types[0];
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface PlanEngineInput {
  // User profile
  currentWeightKg: number;
  maintenanceCalories: number;
  weightLossRate: string; // aggressive | moderate | conservative | maintain
  foodExclusions: string[];
  currentSupplements: string[];
  appetiteProfile: string | null;
  preferredFoods: string[];

  // Protocol
  protocol: ProtocolFile;

  // Resolved activity type for today (null = rest day)
  todayActivityType: ActivityType | null;

  // Resolved activity type for tomorrow (for carb loading check)
  tomorrowActivityType: ActivityType | null;

  // Today's scheduled event
  todayEvent: {
    id: number;
    title: string;
    scheduledAt: string;
    durationMinutes: number | null;
  } | null;

  // Tomorrow's event (for carb loading)
  tomorrowEvent: {
    durationMinutes: number | null;
    scheduledAt: string;
  } | null;

  // Yesterday's plan meals (for variety)
  yesterdayMeals: string[];

  // Ingredient pool from weekly strategy (null if none set)
  ingredientPool: string[] | null;

  // Recent feedback for guardrail adjustments
  recentFeedback: {
    highHungerDays: number;
    lowEnergyDays: number;
    looseStoolDays: number;
    constipatedDays: number;
    lowComplianceDays: number;
  };

  // Glycogen carry-forward
  previousGlycogen: number | null; // 0-100 from yesterday's plan, null if no plan
  previousDayHadTraining: boolean;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface MealSlot {
  name: string;
  timing: string;
  purpose: string;
  calorieTarget: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface OnBikeBrief {
  carbsPerHour: number;
  durationMinutes: number;
  totalOnBikeCarbsG: number;
  preRide: {
    timing: string;
    focus: string;
  };
  postRide: {
    timing: string;
    proteinG: number;
    carbsG: number;
    focus: string;
  };
}

export interface GuardrailAdjustment {
  type: string;
  description: string;
  calorieAdjustment: number;
  carbAdjustment: number;
}

export interface DayBrief {
  date: string;
  dayType: 'rest' | 'training' | 'race';

  trainingEvent: {
    id: number;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    activityTypeName: string;
  } | null;

  totalCalories: number;
  totalCarbsG: number;
  totalProteinG: number;
  totalFatG: number;

  calorieBreakdown: {
    maintenance: number;
    trainingBurn: number;
    calorieOffset: number;
    guardrailAdjustment: number;
    total: number;
  };

  mealSlots: MealSlot[];
  onBikeFuelling: OnBikeBrief | null;
  carbLoadContext: string | null;
  glycogenBattery: number;
  guardrails: GuardrailAdjustment[];

  yesterdayMeals: string[];
  ingredientPool: string[] | null;
  foodExclusions: string[];
  currentSupplements: string[];
  appetiteProfile: string | null;
  foodPreferences: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface DayMacroRules {
  calorie_offset: number;
  add_training_burn: boolean;
  carbs_g_per_kg: MacroRange;
  protein_g_per_kg: MacroRange;
  fat_g_per_kg: MacroRange;
}

function getDayMacroRules(protocol: ProtocolFile, activityType: ActivityType | null): DayMacroRules {
  if (activityType === null) {
    return {
      calorie_offset:    protocol.rest_day.calorie_offset,
      add_training_burn: false,
      carbs_g_per_kg:    protocol.rest_day.carbs_g_per_kg,
      protein_g_per_kg:  protocol.rest_day.protein_g_per_kg,
      fat_g_per_kg:      protocol.rest_day.fat_g_per_kg,
    };
  }
  return {
    calorie_offset:    activityType.calorie_offset,
    add_training_burn: activityType.add_training_burn,
    carbs_g_per_kg:    activityType.carbs_g_per_kg,
    protein_g_per_kg:  activityType.protein_g_per_kg,
    fat_g_per_kg:      activityType.fat_g_per_kg,
  };
}

function midpoint(range: MacroRange): number {
  return (range.min + range.max) / 2;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function appetiteHas(profile: string | null, keyword: string): boolean {
  if (!profile) return false;
  return profile.toLowerCase().includes(keyword.toLowerCase());
}

// ─── B. Training burn ─────────────────────────────────────────────────────────

function estimateTrainingBurn(activityType: ActivityType | null, durationMinutes: number): number {
  if (!activityType) return 0;
  return Math.round(activityType.burn_rate_kcal_per_min * durationMinutes);
}

// ─── D. Guardrail adjustments ─────────────────────────────────────────────────

function computeGuardrails(feedback: PlanEngineInput['recentFeedback']): GuardrailAdjustment[] {
  const result: GuardrailAdjustment[] = [];

  if (feedback.highHungerDays >= 3) {
    result.push({
      type: 'hunger',
      description: 'High hunger — adding 200 kcal',
      calorieAdjustment: 200,
      carbAdjustment: 50,
    });
  }

  if (feedback.lowEnergyDays >= 3) {
    result.push({
      type: 'energy',
      description: 'Low energy — adding 150 kcal to reduce deficit',
      calorieAdjustment: 150,
      carbAdjustment: 38,
    });
  }

  if (feedback.looseStoolDays >= 3) {
    result.push({
      type: 'stool_loose',
      description: 'Loose stools — simplify meals, reduce high-fibre foods temporarily',
      calorieAdjustment: 0,
      carbAdjustment: 0,
    });
  }

  if (feedback.constipatedDays >= 3) {
    result.push({
      type: 'stool_hard',
      description: 'Constipation — increase fibre and fluid intake',
      calorieAdjustment: 0,
      carbAdjustment: 0,
    });
  }

  if (feedback.lowComplianceDays >= 3) {
    result.push({
      type: 'compliance',
      description: 'Low compliance — simpler meals with fewer ingredients',
      calorieAdjustment: 0,
      carbAdjustment: 0,
    });
  }

  return result;
}

// ─── E. Macro targets ─────────────────────────────────────────────────────────

function computeMacros(
  weightKg: number,
  dayRules: DayMacroRules,
  isTrainingDay: boolean,
  guardrailCarbsG: number,
  totalCalories: number,
): { carbsG: number; proteinG: number; fatG: number } {
  // Training days bias toward high end of carb range for performance
  const carbMult = isTrainingDay
    ? dayRules.carbs_g_per_kg.min * 0.3 + dayRules.carbs_g_per_kg.max * 0.7
    : midpoint(dayRules.carbs_g_per_kg);

  const carbsG = Math.round(weightKg * carbMult + guardrailCarbsG);
  const proteinG = Math.round(weightKg * midpoint(dayRules.protein_g_per_kg));
  let fatG = Math.round(weightKg * midpoint(dayRules.fat_g_per_kg));

  // Reconcile with calorie target — fat is the flex macro
  const macroCalories = carbsG * 4 + proteinG * 4 + fatG * 9;
  const diff = totalCalories - macroCalories;
  if (Math.abs(diff) > 100) {
    fatG = Math.max(0, fatG + Math.round(diff / 9));
  }

  return { carbsG, proteinG, fatG };
}

// ─── F. Carb loading check ────────────────────────────────────────────────────

function checkCarbLoading(
  tomorrowActivityType: ActivityType | null,
  tomorrowDurationMinutes: number | null,
): string | null {
  if (!tomorrowActivityType) return null;

  const dur = tomorrowDurationMinutes ?? tomorrowActivityType.default_duration_minutes;
  const isHeavy = tomorrowActivityType.is_race
    || tomorrowActivityType.burn_rate_kcal_per_min >= 8
    || dur >= 90;

  if (!isHeavy) return null;
  return `Carb loading for tomorrow's ${tomorrowActivityType.name}`;
}

// ─── G. On-bike fuelling ──────────────────────────────────────────────────────

function computeOnBikeFuelling(
  event: NonNullable<PlanEngineInput['todayEvent']>,
  activityType: ActivityType,
  weightKg: number,
): OnBikeBrief | null {
  const during = activityType.during_activity;
  if (!during) return null; // no during-activity fuelling (e.g. gym, short S&C)

  const duration = event.durationMinutes ?? activityType.default_duration_minutes;
  const carbsPerHour = during.carbs_per_hour;
  const totalOnBikeCarbsG = Math.round(carbsPerHour * duration / 60);

  const actStart = new Date(event.scheduledAt);
  const preTime  = subtractHours(actStart, activityType.pre_activity.timing_hours_before);
  const actEnd   = addMinutes(actStart, duration);
  const postTime = addMinutes(actEnd, activityType.post_activity.timing_minutes_after);

  return {
    carbsPerHour,
    durationMinutes: duration,
    totalOnBikeCarbsG,
    preRide: {
      timing: `${formatTime(preTime)} — ${activityType.pre_activity.timing_hours_before}hrs before`,
      focus:  activityType.pre_activity.focus,
    },
    postRide: {
      timing:   `${formatTime(postTime)} — within ${activityType.post_activity.timing_minutes_after}min of finishing`,
      proteinG: Math.round(activityType.post_activity.protein_g_per_kg * weightKg),
      carbsG:   Math.round(activityType.post_activity.carbs_g_per_kg * weightKg),
      focus:    activityType.post_activity.focus,
    },
  };
}

// ─── H. Meal slots ────────────────────────────────────────────────────────────

function makeMealSlot(
  name: string,
  timing: string,
  purpose: string,
  carbsG: number,
  proteinG: number,
  fatG: number,
): MealSlot {
  const c = Math.max(0, Math.round(carbsG));
  const p = Math.max(0, Math.round(proteinG));
  const f = Math.max(0, Math.round(fatG));
  return {
    name,
    timing,
    purpose,
    carbsG: c,
    proteinG: p,
    fatG: f,
    calorieTarget: c * 4 + p * 4 + f * 9,
  };
}

// Move carbs from earlier meals to dinner (don't change total calories)
function applyCarbLoading(slots: MealSlot[]): MealSlot[] {
  const dinnerIdx = slots.findIndex(s => s.name === 'Dinner');
  if (dinnerIdx === -1) return slots;

  const dinner = slots[dinnerIdx];
  const extra = Math.round(dinner.carbsG * 0.3);
  if (extra === 0) return slots;

  const donorIdxs = slots
    .map((_, i) => i)
    .filter(i => i !== dinnerIdx && !slots[i].name.startsWith('Post-'));

  const totalDonorCarbs = donorIdxs.reduce((s, i) => s + slots[i].carbsG, 0);
  if (totalDonorCarbs === 0) return slots;

  const result = slots.map(s => ({ ...s }));
  result[dinnerIdx] = {
    ...dinner,
    carbsG: dinner.carbsG + extra,
    calorieTarget: (dinner.carbsG + extra) * 4 + dinner.proteinG * 4 + dinner.fatG * 9,
  };

  let transferred = 0;
  donorIdxs.forEach((idx, pos) => {
    const s = result[idx];
    const isLast = pos === donorIdxs.length - 1;
    const share = isLast
      ? Math.min(extra - transferred, s.carbsG)
      : Math.min(Math.round(extra * s.carbsG / totalDonorCarbs), s.carbsG);
    const newCarbs = s.carbsG - share;
    result[idx] = {
      ...s,
      carbsG: newCarbs,
      calorieTarget: newCarbs * 4 + s.proteinG * 4 + s.fatG * 9,
    };
    transferred += share;
  });

  return result;
}

function buildRestDaySlots(
  totalCarbsG: number,
  totalProteinG: number,
  totalFatG: number,
  appetiteProfile: string | null,
  carbLoadContext: string | null,
): MealSlot[] {
  const noSnacking  = appetiteHas(appetiteProfile, 'no snack')
    || appetiteHas(appetiteProfile, '3 big meals')
    || appetiteHas(appetiteProfile, 'no snacking');
  const doneBy7     = appetiteHas(appetiteProfile, 'done eating by 7')
    || appetiteHas(appetiteProfile, 'done by 7pm')
    || appetiteHas(appetiteProfile, '7pm');
  const grazing     = appetiteHas(appetiteProfile, 'little and often')
    || appetiteHas(appetiteProfile, 'grazing');
  const bigBreakfast = appetiteHas(appetiteProfile, 'big breakfast');
  const lightMorning = appetiteHas(appetiteProfile, 'light morning');

  if (grazing) {
    const dinnerTime = doneBy7 ? '18:00' : '19:00';
    const s = [
      makeMealSlot('Breakfast',       '07:00', 'Main meal',   totalCarbsG * 0.20, totalProteinG * 0.20, totalFatG * 0.20),
      makeMealSlot('Mid-morning',     '10:00', 'Light snack', totalCarbsG * 0.15, totalProteinG * 0.15, totalFatG * 0.15),
      makeMealSlot('Lunch',           '13:00', 'Main meal',   totalCarbsG * 0.25, totalProteinG * 0.25, totalFatG * 0.25),
      makeMealSlot('Afternoon snack', '16:00', 'Light snack', totalCarbsG * 0.15, totalProteinG * 0.15, totalFatG * 0.15),
      makeMealSlot('Dinner',          dinnerTime, 'Main meal', totalCarbsG * 0.25, totalProteinG * 0.25, totalFatG * 0.25),
    ];
    return carbLoadContext ? applyCarbLoading(s) : s;
  }

  let bfFrac = 0.25, lunchFrac = 0.35, dinnerFrac = 0.35, snackFrac = 0.05;

  if (bigBreakfast) {
    bfFrac = 0.35; lunchFrac = 0.35; dinnerFrac = 0.25; snackFrac = 0.05;
  } else if (lightMorning) {
    bfFrac = 0.20; lunchFrac = 0.30; dinnerFrac = 0.45; snackFrac = 0.05;
  }

  const includeSnack = !noSnacking && !doneBy7;
  if (!includeSnack) {
    dinnerFrac += snackFrac;
    snackFrac = 0;
  }

  const dinnerTime = doneBy7 ? '18:00' : '18:30';

  const slots: MealSlot[] = [
    makeMealSlot('Breakfast', '07:30', 'Main meal', totalCarbsG * bfFrac,    totalProteinG * bfFrac,    totalFatG * bfFrac),
    makeMealSlot('Lunch',     '12:30', 'Main meal', totalCarbsG * lunchFrac, totalProteinG * lunchFrac, totalFatG * lunchFrac),
    makeMealSlot('Dinner',    dinnerTime, 'Main meal', totalCarbsG * dinnerFrac, totalProteinG * dinnerFrac, totalFatG * dinnerFrac),
  ];

  if (includeSnack) {
    slots.push(makeMealSlot('Evening snack', '20:30', 'Light snack',
      totalCarbsG * snackFrac, totalProteinG * snackFrac, totalFatG * snackFrac));
  }

  return carbLoadContext ? applyCarbLoading(slots) : slots;
}

function buildTrainingDaySlots(
  event: NonNullable<PlanEngineInput['todayEvent']>,
  activityType: ActivityType,
  totalCarbsG: number,
  totalProteinG: number,
  totalFatG: number,
  weightKg: number,
  carbLoadContext: string | null,
): MealSlot[] {
  const duration      = event.durationMinutes ?? activityType.default_duration_minutes;
  const actStart      = new Date(event.scheduledAt);
  const actHour       = actStart.getHours();
  const actEnd        = addMinutes(actStart, duration);
  const preTime       = subtractHours(actStart, activityType.pre_activity.timing_hours_before);
  const postTime      = addMinutes(actEnd, activityType.post_activity.timing_minutes_after);

  const postRideCarbsG   = Math.round(activityType.post_activity.carbs_g_per_kg * weightKg);
  const postRideProteinG = Math.round(activityType.post_activity.protein_g_per_kg * weightKg);
  const postRideFatG     = Math.round(totalFatG * 0.10);

  const isMorningSession = actHour < 12;
  let slots: MealSlot[];

  if (isMorningSession) {
    const preRideCarbsG   = Math.round(totalCarbsG * 0.20);
    const preRideProteinG = Math.round(totalProteinG * 0.10);
    const preRideFatG     = Math.round(totalFatG * 0.05);

    const remCarbsG   = Math.max(0, totalCarbsG   - preRideCarbsG   - postRideCarbsG);
    const remProteinG = Math.max(0, totalProteinG - preRideProteinG - postRideProteinG);
    const remFatG     = Math.max(0, totalFatG     - preRideFatG     - postRideFatG);

    const postRideHour    = postTime.getHours();
    const postRideIsLunch = postRideHour >= 11 && postRideHour <= 14;

    if (postRideIsLunch) {
      slots = [
        makeMealSlot('Pre-activity',       formatTime(preTime),  'Pre-activity fuel', preRideCarbsG,  preRideProteinG,  preRideFatG),
        makeMealSlot('Post-activity meal', formatTime(postTime), 'Recovery',          postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',             '18:30',              'Main meal',         remCarbsG,      remProteinG,      remFatG),
      ];
    } else {
      const lunchCarbsG   = Math.round(remCarbsG   * 0.40);
      const lunchProteinG = Math.round(remProteinG * 0.40);
      const lunchFatG     = Math.round(remFatG     * 0.40);
      const dinnerCarbsG  = remCarbsG   - lunchCarbsG;
      const dinnerProtein = remProteinG - lunchProteinG;
      const dinnerFatG    = remFatG     - lunchFatG;

      slots = [
        makeMealSlot('Pre-activity',       formatTime(preTime),  'Pre-activity fuel', preRideCarbsG, preRideProteinG, preRideFatG),
        makeMealSlot('Post-activity meal', formatTime(postTime), 'Recovery',          postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Lunch',              '12:30',              'Main meal',         lunchCarbsG,    lunchProteinG,   lunchFatG),
        makeMealSlot('Dinner',             '18:30',              'Main meal',         dinnerCarbsG,   dinnerProtein,   dinnerFatG),
      ];
    }
  } else {
    // Afternoon / evening session
    const bfCarbsG   = Math.round(totalCarbsG   * 0.25);
    const bfProteinG = Math.round(totalProteinG * 0.25);
    const bfFatG     = Math.round(totalFatG     * 0.25);

    const preRideCarbsG   = Math.round(totalCarbsG   * 0.15);
    const preRideProteinG = Math.round(totalProteinG * 0.10);
    const preRideFatG     = Math.round(totalFatG     * 0.05);

    const remCarbsG   = Math.max(0, totalCarbsG   - bfCarbsG   - preRideCarbsG   - postRideCarbsG);
    const remProteinG = Math.max(0, totalProteinG - bfProteinG - preRideProteinG - postRideProteinG);
    const remFatG     = Math.max(0, totalFatG     - bfFatG     - preRideFatG     - postRideFatG);

    const earliestDinner = new Date(actStart);
    earliestDinner.setHours(19, 30, 0, 0);
    const dinnerDate = postTime > earliestDinner ? addMinutes(postTime, 30) : earliestDinner;
    const dinnerTime = formatTime(dinnerDate);

    if (actHour >= 14) {
      const lunchCarbsG  = Math.round(remCarbsG   * 0.55);
      const lunchProtein = Math.round(remProteinG * 0.55);
      const lunchFatG    = Math.round(remFatG     * 0.55);
      const dinCarbsG    = remCarbsG   - lunchCarbsG;
      const dinProtein   = remProteinG - lunchProtein;
      const dinFatG      = remFatG     - lunchFatG;

      slots = [
        makeMealSlot('Breakfast',           '07:30',              'Main meal',         bfCarbsG,      bfProteinG,      bfFatG),
        makeMealSlot('Lunch',               '12:00',              'Main meal',         lunchCarbsG,   lunchProtein,    lunchFatG),
        makeMealSlot('Pre-activity snack',  formatTime(preTime),  'Pre-activity fuel', preRideCarbsG, preRideProteinG, preRideFatG),
        makeMealSlot('Post-activity meal',  formatTime(postTime), 'Recovery',          postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',              dinnerTime,           'Main meal',         dinCarbsG,     dinProtein,      dinFatG),
      ];
    } else {
      const combinedCarbsG  = preRideCarbsG   + Math.round(remCarbsG   * 0.50);
      const combinedProtein = preRideProteinG + Math.round(remProteinG * 0.50);
      const combinedFatG    = preRideFatG     + Math.round(remFatG     * 0.50);
      const dinCarbsG       = Math.max(0, remCarbsG   - Math.round(remCarbsG   * 0.50));
      const dinProtein      = Math.max(0, remProteinG - Math.round(remProteinG * 0.50));
      const dinFatG         = Math.max(0, remFatG     - Math.round(remFatG     * 0.50));

      slots = [
        makeMealSlot('Breakfast',               '07:30',              'Main meal',         bfCarbsG,       bfProteinG,    bfFatG),
        makeMealSlot('Lunch / Pre-activity',    formatTime(preTime),  'Pre-activity fuel', combinedCarbsG, combinedProtein, combinedFatG),
        makeMealSlot('Post-activity meal',      formatTime(postTime), 'Recovery',          postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',                  dinnerTime,           'Main meal',         dinCarbsG,      dinProtein,    dinFatG),
      ];
    }
  }

  return carbLoadContext ? applyCarbLoading(slots) : slots;
}

// ─── I. Glycogen estimate ─────────────────────────────────────────────────────

function estimateGlycogen(
  previousGlycogen: number | null,
  previousDayHadTraining: boolean,
  dayType: 'rest' | 'training' | 'race',
  trainingBurn: number,
): number {
  let g = previousGlycogen ?? 50;
  if (previousDayHadTraining) g -= 30;
  if (dayType === 'rest') {
    g += 20;
  } else {
    g -= trainingBurn / 40;
  }
  return Math.round(clamp(g, 0, 100));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeDayBrief(input: PlanEngineInput, date: string): DayBrief {
  const { todayActivityType, todayEvent, tomorrowActivityType, tomorrowEvent } = input;

  // A. Day type
  const dayType: 'rest' | 'training' | 'race' =
    todayActivityType === null ? 'rest' :
    todayActivityType.is_race  ? 'race' : 'training';

  // B. Training burn
  const eventDuration = todayEvent?.durationMinutes ?? todayActivityType?.default_duration_minutes ?? 60;
  const trainingBurn  = estimateTrainingBurn(todayActivityType, eventDuration);

  // C. Calorie target
  const dayRules = getDayMacroRules(input.protocol, todayActivityType);
  let baseCalories = input.maintenanceCalories + dayRules.calorie_offset;
  if (dayRules.add_training_burn) baseCalories += trainingBurn;

  // D. Guardrails
  const guardrails       = computeGuardrails(input.recentFeedback);
  const guardrailCalAdj  = guardrails.reduce((s, g) => s + g.calorieAdjustment, 0);
  const guardrailCarbAdj = guardrails.reduce((s, g) => s + g.carbAdjustment, 0);
  const totalCalories    = Math.round(baseCalories + guardrailCalAdj);

  // E. Macros
  const { carbsG, proteinG, fatG } = computeMacros(
    input.currentWeightKg,
    dayRules,
    dayType !== 'rest',
    guardrailCarbAdj,
    totalCalories,
  );

  // F. Carb loading
  const carbLoadContext = checkCarbLoading(
    tomorrowActivityType,
    tomorrowEvent?.durationMinutes ?? null,
  );

  // G. On-bike / during-activity fuelling
  const onBikeFuelling = todayEvent && todayActivityType
    ? computeOnBikeFuelling(todayEvent, todayActivityType, input.currentWeightKg)
    : null;

  // H. Meal slots
  const mealSlots = dayType === 'rest' || !todayEvent || !todayActivityType
    ? buildRestDaySlots(carbsG, proteinG, fatG, input.appetiteProfile, carbLoadContext)
    : buildTrainingDaySlots(
        todayEvent, todayActivityType,
        carbsG, proteinG, fatG, input.currentWeightKg,
        carbLoadContext,
      );

  // I. Glycogen
  const glycogenBattery = estimateGlycogen(
    input.previousGlycogen,
    input.previousDayHadTraining,
    dayType,
    trainingBurn,
  );

  return {
    date,
    dayType,
    trainingEvent: todayEvent && todayActivityType ? {
      id:               todayEvent.id,
      title:            todayEvent.title,
      scheduledAt:      todayEvent.scheduledAt,
      durationMinutes:  eventDuration,
      activityTypeName: todayActivityType.name,
    } : null,
    totalCalories,
    totalCarbsG:   carbsG,
    totalProteinG: proteinG,
    totalFatG:     fatG,
    calorieBreakdown: {
      maintenance:         input.maintenanceCalories,
      trainingBurn,
      calorieOffset:       dayRules.calorie_offset,
      guardrailAdjustment: guardrailCalAdj,
      total:               totalCalories,
    },
    mealSlots,
    onBikeFuelling,
    carbLoadContext,
    glycogenBattery,
    guardrails,
    yesterdayMeals:     input.yesterdayMeals,
    ingredientPool:     input.ingredientPool,
    foodExclusions:     input.foodExclusions,
    currentSupplements: input.currentSupplements,
    appetiteProfile:    input.appetiteProfile,
    foodPreferences:    input.preferredFoods,
  };
}
