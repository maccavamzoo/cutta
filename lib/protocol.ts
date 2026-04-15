// Activity type definitions.
// Rest-day macros now live in user_profiles; activity types live in user_activity_types table.

// ─── Activity-level fuelling rules ──────────────────────────────────────────

export interface DuringActivityRules {
  /** Carbs per hour. 0 means water/electrolytes only */
  carbs_per_hour: number;
  /** Description shown in readable view */
  description: string;
}

export interface ActivityPreRules {
  timing_hours_before: number;
  focus: string;
}

export interface ActivityPostRules {
  timing_minutes_after: number;
  focus: string;
  protein_g_per_kg: number;
  carbs_g_per_kg: number;
}

// ─── Activity type ──────────────────────────────────────────────────────────

export interface ActivityType {
  /** Display name, e.g. "Hard ride", "Easy ride", "S&C / Gym", "Run" */
  name: string;
  /** Short description for the UI */
  description: string;
  /** Estimated kcal burned per minute for this activity */
  burn_rate_kcal_per_min: number;
  /** Day macro targets (g per kg body weight) */
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
  /** Pre-activity nutrition */
  pre_activity: ActivityPreRules;
  /** During-activity fuelling. Null for activities with no during-fuelling */
  during_activity: DuringActivityRules | null;
  /** Post-activity recovery */
  post_activity: ActivityPostRules;
  /** Default duration in minutes (used when user doesn't specify) */
  default_duration_minutes: number;
  /** Whether this is a race-type activity */
  is_race: boolean;
}

// ─── Row → ActivityType helper ──────────────────────────────────────────────

/** Convert a user_activity_types DB row into the ActivityType shape used by the plan engine. */
export function rowToActivityType(row: {
  name: string;
  description: string | null;
  burnRateKcalPerMin: string | null;
  carbsGPerKg: string | null;
  proteinGPerKg: string | null;
  preActivity: unknown;
  duringActivity: unknown;
  postActivity: unknown;
  defaultDurationMinutes: number | null;
  isRace: boolean;
}): ActivityType {
  return {
    name:                   row.name,
    description:            row.description ?? "",
    burn_rate_kcal_per_min: Number(row.burnRateKcalPerMin) || 8,
    carbs_g_per_kg:         Number(row.carbsGPerKg) || 5,
    protein_g_per_kg:       Number(row.proteinGPerKg) || 1.8,
    pre_activity:           (row.preActivity as ActivityPreRules) ?? { timing_hours_before: 2, focus: "Moderate carbs, low fibre" },
    during_activity:        (row.duringActivity as DuringActivityRules | null) ?? null,
    post_activity:          (row.postActivity as ActivityPostRules) ?? { timing_minutes_after: 30, focus: "Protein and carbs for recovery", protein_g_per_kg: 0.3, carbs_g_per_kg: 0.8 },
    default_duration_minutes: row.defaultDurationMinutes ?? 60,
    is_race:                row.isRace,
  };
}
