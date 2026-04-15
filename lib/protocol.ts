// Protocol file type and validation.
// Phase 6A: activity_types array replaces single training_day/pre_ride/on_bike/post_ride.

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

// ─── Rest day (always present) ──────────────────────────────────────────────

export interface RestDayRules {
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
}

// ─── The full protocol ──────────────────────────────────────────────────────

export interface ProtocolFile {
  protocol_name: string;
  description: string;
  rest_day: RestDayRules;
  activity_types: ActivityType[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

type ValidationOk   = { valid: true;  data: ProtocolFile };
type ValidationFail = { valid: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

function validateRestDay(v: unknown): ValidationResult | null {
  if (typeof v !== "object" || v === null) {
    return { valid: false, error: '"rest_day" must be an object.' };
  }
  const obj = v as Record<string, unknown>;
  if (typeof obj.carbs_g_per_kg !== "number") {
    return { valid: false, error: '"rest_day.carbs_g_per_kg" must be a number.' };
  }
  if (typeof obj.protein_g_per_kg !== "number") {
    return { valid: false, error: '"rest_day.protein_g_per_kg" must be a number.' };
  }
  return null;
}

function validateActivityType(v: unknown, index: number): ValidationResult | null {
  if (typeof v !== "object" || v === null) {
    return { valid: false, error: `activity_types[${index}] must be an object.` };
  }
  const a = v as Record<string, unknown>;

  if (typeof a.name !== "string" || a.name.trim().length === 0) {
    return { valid: false, error: `activity_types[${index}].name must be a non-empty string.` };
  }
  if (typeof a.description !== "string") {
    return { valid: false, error: `activity_types[${index}].description must be a string.` };
  }
  if (typeof a.burn_rate_kcal_per_min !== "number") {
    return { valid: false, error: `activity_types[${index}].burn_rate_kcal_per_min must be a number.` };
  }
  if (typeof a.carbs_g_per_kg !== "number") {
    return { valid: false, error: `activity_types[${index}].carbs_g_per_kg must be a number.` };
  }
  if (typeof a.protein_g_per_kg !== "number") {
    return { valid: false, error: `activity_types[${index}].protein_g_per_kg must be a number.` };
  }

  // pre_activity
  if (typeof a.pre_activity !== "object" || a.pre_activity === null) {
    return { valid: false, error: `activity_types[${index}].pre_activity must be an object.` };
  }
  const pre = a.pre_activity as Record<string, unknown>;
  if (typeof pre.timing_hours_before !== "number") {
    return { valid: false, error: `activity_types[${index}].pre_activity.timing_hours_before must be a number.` };
  }
  if (typeof pre.focus !== "string") {
    return { valid: false, error: `activity_types[${index}].pre_activity.focus must be a string.` };
  }

  // during_activity (nullable)
  if (a.during_activity !== null && a.during_activity !== undefined) {
    if (typeof a.during_activity !== "object") {
      return { valid: false, error: `activity_types[${index}].during_activity must be an object or null.` };
    }
    const dur = a.during_activity as Record<string, unknown>;
    if (typeof dur.carbs_per_hour !== "number") {
      return { valid: false, error: `activity_types[${index}].during_activity.carbs_per_hour must be a number.` };
    }
    if (typeof dur.description !== "string") {
      return { valid: false, error: `activity_types[${index}].during_activity.description must be a string.` };
    }
  }

  // post_activity
  if (typeof a.post_activity !== "object" || a.post_activity === null) {
    return { valid: false, error: `activity_types[${index}].post_activity must be an object.` };
  }
  const post = a.post_activity as Record<string, unknown>;
  if (typeof post.timing_minutes_after !== "number") {
    return { valid: false, error: `activity_types[${index}].post_activity.timing_minutes_after must be a number.` };
  }
  if (typeof post.focus !== "string") {
    return { valid: false, error: `activity_types[${index}].post_activity.focus must be a string.` };
  }
  if (typeof post.protein_g_per_kg !== "number") {
    return { valid: false, error: `activity_types[${index}].post_activity.protein_g_per_kg must be a number.` };
  }
  if (typeof post.carbs_g_per_kg !== "number") {
    return { valid: false, error: `activity_types[${index}].post_activity.carbs_g_per_kg must be a number.` };
  }

  if (typeof a.default_duration_minutes !== "number") {
    return { valid: false, error: `activity_types[${index}].default_duration_minutes must be a number.` };
  }
  if (typeof a.is_race !== "boolean") {
    return { valid: false, error: `activity_types[${index}].is_race must be a boolean.` };
  }

  return null;
}

export function validateProtocol(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: "Protocol must be a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.protocol_name || typeof obj.protocol_name !== "string") {
    return { valid: false, error: 'Protocol must include a "protocol_name" string field.' };
  }
  if (obj.protocol_name.trim().length === 0) {
    return { valid: false, error: '"protocol_name" cannot be empty.' };
  }
  if (typeof obj.description !== "string") {
    return { valid: false, error: '"description" must be a string.' };
  }

  const restErr = validateRestDay(obj.rest_day);
  if (restErr) return restErr;

  if (!Array.isArray(obj.activity_types) || obj.activity_types.length === 0) {
    return { valid: false, error: '"activity_types" must be an array with at least one entry.' };
  }
  for (let i = 0; i < obj.activity_types.length; i++) {
    const err = validateActivityType(obj.activity_types[i] as unknown, i);
    if (err) return err;
  }

  return { valid: true, data: obj as unknown as ProtocolFile };
}
