// Plan pre-computation engine.
// Pure deterministic module — no AI calls, no DB calls, no side effects.
// Takes user data + protocol and produces a complete DayBrief for one day.

import type { ProtocolFile, MacroRange } from './protocol';

// ─── Phase 6A compatibility shim ─────────────────────────────────────────────
// plan-engine.ts uses a flat "training_day / pre_ride / on_bike / post_ride"
// model.  Phase 6B will rewrite it to use activity_types natively.  For now,
// buildLegacyCompat() maps the first non-race ActivityType to the old shapes.

interface DayMacrosLike {
  calorie_offset:    number;
  add_training_burn: boolean;
  carbs_g_per_kg:    MacroRange;
  protein_g_per_kg:  MacroRange;
  fat_g_per_kg:      MacroRange;
}

interface LegacyCompat {
  rest_day:     DayMacrosLike;
  training_day: DayMacrosLike;
  pre_ride:  { timing_hours_before: number; focus: string };
  on_bike:   { under_90min_carbs_per_hour: number; over_90min_carbs_per_hour: MacroRange; over_3hrs_carbs_per_hour: MacroRange };
  post_ride: { timing_minutes_after: number; focus: string; protein_g_per_kg: number; carbs_g_per_kg: number };
}

function buildLegacyCompat(protocol: ProtocolFile): LegacyCompat {
  const fallback = protocol.activity_types.find(a => !a.is_race) ?? protocol.activity_types[0];
  const c = fallback.during_activity?.carbs_per_hour ?? 0;
  return {
    rest_day: {
      calorie_offset:    protocol.rest_day.calorie_offset,
      add_training_burn: false,
      carbs_g_per_kg:    protocol.rest_day.carbs_g_per_kg,
      protein_g_per_kg:  protocol.rest_day.protein_g_per_kg,
      fat_g_per_kg:      protocol.rest_day.fat_g_per_kg,
    },
    training_day: {
      calorie_offset:    fallback.calorie_offset,
      add_training_burn: fallback.add_training_burn,
      carbs_g_per_kg:    fallback.carbs_g_per_kg,
      protein_g_per_kg:  fallback.protein_g_per_kg,
      fat_g_per_kg:      fallback.fat_g_per_kg,
    },
    pre_ride: {
      timing_hours_before: fallback.pre_activity.timing_hours_before,
      focus:               fallback.pre_activity.focus,
    },
    on_bike: {
      under_90min_carbs_per_hour: c,
      over_90min_carbs_per_hour:  { min: c, max: c },
      over_3hrs_carbs_per_hour:   { min: c, max: c },
    },
    post_ride: {
      timing_minutes_after: fallback.post_activity.timing_minutes_after,
      focus:                fallback.post_activity.focus,
      protein_g_per_kg:     fallback.post_activity.protein_g_per_kg,
      carbs_g_per_kg:       fallback.post_activity.carbs_g_per_kg,
    },
  };
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
  gutSensitivity: string | null;
  foodProfile: {
    positive?: string[];
    negative?: string[];
    gutTriggers?: string[];
  } | null;

  // Protocol (new numeric format)
  protocol: ProtocolFile;

  // Today's calendar events
  todayEvents: {
    id: number;
    title: string;
    eventType: string; // ride | race | rest | other
    scheduledAt: string; // ISO datetime
    durationMinutes: number | null;
    intensity: string | null; // easy | moderate | hard | race
  }[];

  // Tomorrow's calendar events (for carb loading logic)
  tomorrowEvents: {
    eventType: string;
    durationMinutes: number | null;
    intensity: string | null;
    scheduledAt: string;
  }[];

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
    intensity: string;
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
  gutSensitivity: string | null;
  foodPreferences: string[];
  gutTriggers: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type EventEntry = PlanEngineInput['todayEvents'][0];

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

function getDefaultDuration(intensity: string | null): number {
  if (intensity === 'easy') return 60;
  if (intensity === 'hard') return 90;
  if (intensity === 'race') return 120;
  return 75; // moderate / default
}

// ─── A. Determine day type ────────────────────────────────────────────────────

function determineDayType(events: PlanEngineInput['todayEvents']): {
  dayType: 'rest' | 'training' | 'race';
  primaryEvent: EventEntry | null;
} {
  const active = events.filter(e => e.eventType === 'ride' || e.eventType === 'race');
  if (active.length === 0) return { dayType: 'rest', primaryEvent: null };

  const races = active.filter(e => e.eventType === 'race');
  const pool = races.length > 0 ? races : active;

  // Prefer longest duration; ties broken by first in array
  const primary = pool.reduce((a, b) =>
    (b.durationMinutes ?? 0) > (a.durationMinutes ?? 0) ? b : a
  );

  return {
    dayType: races.length > 0 ? 'race' : 'training',
    primaryEvent: primary,
  };
}

// ─── B. Estimate training burn ────────────────────────────────────────────────

function estimateTrainingBurn(event: EventEntry | null): number {
  if (!event) return 0;

  const intensity = event.intensity ?? (event.eventType === 'race' ? 'race' : 'moderate');
  const kcalPerMin = intensity === 'easy' ? 5
    : intensity === 'hard' ? 11
    : (intensity === 'race' || event.eventType === 'race') ? 12
    : 8; // moderate / default

  const duration = event.durationMinutes ?? getDefaultDuration(intensity);
  return kcalPerMin * duration;
}

// ─── D. Guardrail adjustments ─────────────────────────────────────────────────

function computeGuardrails(feedback: PlanEngineInput['recentFeedback']): GuardrailAdjustment[] {
  const result: GuardrailAdjustment[] = [];

  if (feedback.highHungerDays >= 3) {
    result.push({
      type: 'hunger',
      description: 'High hunger — adding 200 kcal',
      calorieAdjustment: 200,
      carbAdjustment: 50, // 200 kcal / 4 kcal per g
    });
  }

  if (feedback.lowEnergyDays >= 3) {
    result.push({
      type: 'energy',
      description: 'Low energy — adding 150 kcal to reduce deficit',
      calorieAdjustment: 150,
      carbAdjustment: 38, // 150 / 4 rounded
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
  dayRules: DayMacrosLike,
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

function checkCarbLoading(tomorrowEvents: PlanEngineInput['tomorrowEvents']): string | null {
  const event = tomorrowEvents.find(e => {
    if (e.eventType !== 'ride' && e.eventType !== 'race') return false;
    const isLong = (e.durationMinutes ?? 0) >= 90;
    const isHard = e.intensity === 'hard' || e.intensity === 'race' || e.eventType === 'race';
    return isLong || isHard;
  });
  if (!event) return null;

  const dur = event.durationMinutes ? `${event.durationMinutes}min` : '';
  const int = event.intensity ?? '';
  const parts = [int, dur].filter(Boolean).join(' ');
  return `Carb loading for tomorrow's ${parts ? parts + ' ' : ''}${event.eventType}`;
}

// ─── G. On-bike fuelling ──────────────────────────────────────────────────────

function computeOnBikeFuelling(
  event: EventEntry,
  compat: LegacyCompat,
  weightKg: number,
): OnBikeBrief {
  const duration = event.durationMinutes ?? getDefaultDuration(event.intensity);

  const carbsPerHour = duration < 90
    ? compat.on_bike.under_90min_carbs_per_hour
    : duration <= 180
      ? midpoint(compat.on_bike.over_90min_carbs_per_hour)
      : midpoint(compat.on_bike.over_3hrs_carbs_per_hour);

  const totalOnBikeCarbsG = Math.round(carbsPerHour * duration / 60);

  const rideStart = new Date(event.scheduledAt);
  const preRideTime = subtractHours(rideStart, compat.pre_ride.timing_hours_before);
  const rideEnd = addMinutes(rideStart, duration);
  const postRideTime = addMinutes(rideEnd, compat.post_ride.timing_minutes_after);

  return {
    carbsPerHour: Math.round(carbsPerHour),
    durationMinutes: duration,
    totalOnBikeCarbsG,
    preRide: {
      timing: `${formatTime(preRideTime)} — ${compat.pre_ride.timing_hours_before}hrs before ride`,
      focus: compat.pre_ride.focus,
    },
    postRide: {
      timing: `${formatTime(postRideTime)} — within ${compat.post_ride.timing_minutes_after}min of finishing`,
      proteinG: Math.round(compat.post_ride.protein_g_per_kg * weightKg),
      carbsG: Math.round(compat.post_ride.carbs_g_per_kg * weightKg),
      focus: compat.post_ride.focus,
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

  // Donor slots: everything except dinner and post-ride recovery
  const donorIdxs = slots
    .map((_, i) => i)
    .filter(i => i !== dinnerIdx && !slots[i].name.startsWith('Post-ride'));

  const totalDonorCarbs = donorIdxs.reduce((s, i) => s + slots[i].carbsG, 0);
  if (totalDonorCarbs === 0) return slots;

  const result = slots.map(s => ({ ...s }));
  result[dinnerIdx] = {
    ...dinner,
    carbsG: dinner.carbsG + extra,
    calorieTarget: (dinner.carbsG + extra) * 4 + dinner.proteinG * 4 + dinner.fatG * 9,
  };

  // Reduce donors proportionally, last absorbs rounding
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
  const noSnacking = appetiteHas(appetiteProfile, 'no snack')
    || appetiteHas(appetiteProfile, '3 big meals')
    || appetiteHas(appetiteProfile, 'no snacking');
  const doneBy7 = appetiteHas(appetiteProfile, 'done eating by 7')
    || appetiteHas(appetiteProfile, 'done by 7pm')
    || appetiteHas(appetiteProfile, '7pm');
  const grazing = appetiteHas(appetiteProfile, 'little and often')
    || appetiteHas(appetiteProfile, 'grazing');
  const bigBreakfast = appetiteHas(appetiteProfile, 'big breakfast');
  const lightMorning = appetiteHas(appetiteProfile, 'light morning');

  // Grazing: 5 smaller meals
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

  // Standard 3-meal distribution with optional evening snack
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
  event: EventEntry,
  compat: LegacyCompat,
  totalCarbsG: number,
  totalProteinG: number,
  totalFatG: number,
  weightKg: number,
  carbLoadContext: string | null,
): MealSlot[] {
  const duration = event.durationMinutes ?? getDefaultDuration(event.intensity);
  const rideStart = new Date(event.scheduledAt);
  const rideHour = rideStart.getHours();
  const rideEnd = addMinutes(rideStart, duration);
  const preRideTime = subtractHours(rideStart, compat.pre_ride.timing_hours_before);
  const postRideTime = addMinutes(rideEnd, compat.post_ride.timing_minutes_after);

  // Post-ride: fixed amounts from compat
  const postRideCarbsG   = Math.round(compat.post_ride.carbs_g_per_kg * weightKg);
  const postRideProteinG = Math.round(compat.post_ride.protein_g_per_kg * weightKg);
  const postRideFatG     = Math.round(totalFatG * 0.10);

  const isMorningRide = rideHour < 12;
  let slots: MealSlot[];

  if (isMorningRide) {
    // Pre-ride: light high-carb (20% carbs, 10% protein, 5% fat)
    const preRideCarbsG   = Math.round(totalCarbsG * 0.20);
    const preRideProteinG = Math.round(totalProteinG * 0.10);
    const preRideFatG     = Math.round(totalFatG * 0.05);

    // Remaining for the rest of the day
    const remCarbsG   = Math.max(0, totalCarbsG   - preRideCarbsG   - postRideCarbsG);
    const remProteinG = Math.max(0, totalProteinG - preRideProteinG - postRideProteinG);
    const remFatG     = Math.max(0, totalFatG     - preRideFatG     - postRideFatG);

    // If post-ride is around lunchtime (11:00–14:00) it doubles as lunch
    const postRideHour = postRideTime.getHours();
    const postRideIsLunch = postRideHour >= 11 && postRideHour <= 14;

    if (postRideIsLunch) {
      slots = [
        makeMealSlot('Pre-ride',      formatTime(preRideTime),  'Pre-ride fuel', preRideCarbsG,  preRideProteinG,  preRideFatG),
        makeMealSlot('Post-ride meal', formatTime(postRideTime), 'Recovery',     postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',        '18:30',                  'Main meal',     remCarbsG,      remProteinG,      remFatG),
      ];
    } else {
      // Separate lunch and dinner from remaining macros (40% lunch, 60% dinner)
      const lunchCarbsG    = Math.round(remCarbsG   * 0.40);
      const lunchProteinG  = Math.round(remProteinG * 0.40);
      const lunchFatG      = Math.round(remFatG     * 0.40);
      const dinnerCarbsG   = remCarbsG   - lunchCarbsG;
      const dinnerProteinG = remProteinG - lunchProteinG;
      const dinnerFatG     = remFatG     - lunchFatG;

      slots = [
        makeMealSlot('Pre-ride',       formatTime(preRideTime),  'Pre-ride fuel', preRideCarbsG,  preRideProteinG,  preRideFatG),
        makeMealSlot('Post-ride meal', formatTime(postRideTime), 'Recovery',      postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Lunch',          '12:30',                  'Main meal',     lunchCarbsG,    lunchProteinG,    lunchFatG),
        makeMealSlot('Dinner',         '18:30',                  'Main meal',     dinnerCarbsG,   dinnerProteinG,   dinnerFatG),
      ];
    }
  } else {
    // Afternoon / evening ride (12:00+)
    const bfCarbsG   = Math.round(totalCarbsG   * 0.25);
    const bfProteinG = Math.round(totalProteinG * 0.25);
    const bfFatG     = Math.round(totalFatG     * 0.25);

    // Pre-ride snack: lighter than morning pre-ride (15% carbs)
    const preRideCarbsG   = Math.round(totalCarbsG   * 0.15);
    const preRideProteinG = Math.round(totalProteinG * 0.10);
    const preRideFatG     = Math.round(totalFatG     * 0.05);

    // Remaining after breakfast, pre-ride, post-ride
    const remCarbsG   = Math.max(0, totalCarbsG   - bfCarbsG   - preRideCarbsG   - postRideCarbsG);
    const remProteinG = Math.max(0, totalProteinG - bfProteinG - preRideProteinG - postRideProteinG);
    const remFatG     = Math.max(0, totalFatG     - bfFatG     - preRideFatG     - postRideFatG);

    // Dinner time: later of 19:30 and 30min after post-ride meal
    const earliestDinner = new Date(rideStart);
    earliestDinner.setHours(19, 30, 0, 0);
    const dinnerDate = postRideTime > earliestDinner
      ? addMinutes(postRideTime, 30)
      : earliestDinner;
    const dinnerTime = formatTime(dinnerDate);

    if (rideHour >= 14) {
      // Enough gap for a proper lunch at 12:00 before the ride
      const lunchCarbsG    = Math.round(remCarbsG   * 0.55);
      const lunchProteinG  = Math.round(remProteinG * 0.55);
      const lunchFatG      = Math.round(remFatG     * 0.55);
      const dinnerCarbsG   = remCarbsG   - lunchCarbsG;
      const dinnerProteinG = remProteinG - lunchProteinG;
      const dinnerFatG     = remFatG     - lunchFatG;

      slots = [
        makeMealSlot('Breakfast',      '07:30',                   'Main meal',     bfCarbsG,       bfProteinG,       bfFatG),
        makeMealSlot('Lunch',          '12:00',                   'Main meal',     lunchCarbsG,    lunchProteinG,    lunchFatG),
        makeMealSlot('Pre-ride snack', formatTime(preRideTime),   'Pre-ride fuel', preRideCarbsG,  preRideProteinG,  preRideFatG),
        makeMealSlot('Post-ride meal', formatTime(postRideTime),  'Recovery',      postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',         dinnerTime,                'Main meal',     dinnerCarbsG,   dinnerProteinG,   dinnerFatG),
      ];
    } else {
      // Ride 12:00–14:00: combine lunch and pre-ride into one pre-ride meal
      const combinedCarbsG   = preRideCarbsG   + Math.round(remCarbsG   * 0.50);
      const combinedProteinG = preRideProteinG + Math.round(remProteinG * 0.50);
      const combinedFatG     = preRideFatG     + Math.round(remFatG     * 0.50);
      const dinnerCarbsG     = Math.max(0, remCarbsG   - Math.round(remCarbsG   * 0.50));
      const dinnerProteinG   = Math.max(0, remProteinG - Math.round(remProteinG * 0.50));
      const dinnerFatG       = Math.max(0, remFatG     - Math.round(remFatG     * 0.50));

      slots = [
        makeMealSlot('Breakfast',        '07:30',                  'Main meal',     bfCarbsG,       bfProteinG,       bfFatG),
        makeMealSlot('Lunch / Pre-ride', formatTime(preRideTime),  'Pre-ride fuel', combinedCarbsG, combinedProteinG, combinedFatG),
        makeMealSlot('Post-ride meal',   formatTime(postRideTime), 'Recovery',      postRideCarbsG, postRideProteinG, postRideFatG),
        makeMealSlot('Dinner',           dinnerTime,               'Main meal',     dinnerCarbsG,   dinnerProteinG,   dinnerFatG),
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
  // A. Day type
  const { dayType, primaryEvent } = determineDayType(input.todayEvents);

  // B. Training burn
  const trainingBurn = estimateTrainingBurn(primaryEvent);

  // Phase 6A shim — map new activity_types format to legacy flat shape
  const compat = buildLegacyCompat(input.protocol);

  // C. Calorie target
  const dayRules: DayMacrosLike = dayType === 'rest'
    ? compat.rest_day
    : compat.training_day;

  let baseCalories = input.maintenanceCalories + dayRules.calorie_offset;
  if (dayRules.add_training_burn) baseCalories += trainingBurn;

  // D. Guardrails
  const guardrails = computeGuardrails(input.recentFeedback);
  const guardrailCalAdj  = guardrails.reduce((s, g) => s + g.calorieAdjustment, 0);
  const guardrailCarbAdj = guardrails.reduce((s, g) => s + g.carbAdjustment, 0);
  const totalCalories = Math.round(baseCalories + guardrailCalAdj);

  // E. Macros
  const { carbsG, proteinG, fatG } = computeMacros(
    input.currentWeightKg,
    dayRules,
    dayType !== 'rest',
    guardrailCarbAdj,
    totalCalories,
  );

  // F. Carb loading
  const carbLoadContext = checkCarbLoading(input.tomorrowEvents);

  // G. On-bike fuelling
  const onBikeFuelling = primaryEvent
    ? computeOnBikeFuelling(primaryEvent, compat, input.currentWeightKg)
    : null;

  // H. Meal slots
  const mealSlots = dayType === 'rest' || !primaryEvent
    ? buildRestDaySlots(carbsG, proteinG, fatG, input.appetiteProfile, carbLoadContext)
    : buildTrainingDaySlots(
        primaryEvent, compat,
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
    trainingEvent: primaryEvent ? {
      id:              primaryEvent.id,
      title:           primaryEvent.title,
      scheduledAt:     primaryEvent.scheduledAt,
      durationMinutes: primaryEvent.durationMinutes ?? getDefaultDuration(primaryEvent.intensity),
      intensity:       primaryEvent.intensity ?? 'moderate',
    } : null,
    totalCalories,
    totalCarbsG:  carbsG,
    totalProteinG: proteinG,
    totalFatG:    fatG,
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
    yesterdayMeals:   input.yesterdayMeals,
    ingredientPool:   input.ingredientPool,
    foodExclusions:   input.foodExclusions,
    currentSupplements: input.currentSupplements,
    appetiteProfile:  input.appetiteProfile,
    gutSensitivity:   input.gutSensitivity,
    foodPreferences:  input.foodProfile?.positive ?? [],
    gutTriggers:      input.foodProfile?.gutTriggers ?? [],
  };
}
