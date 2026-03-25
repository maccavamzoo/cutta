// Protocol file type and validation.
// Required: protocol_name. All other fields optional but type-checked if present.

export type ProtocolDayMacros = {
  calories?: string;
  carbs?: string;
  protein?: string;
  fat?: string;
  [key: string]: unknown;
};

export type ProtocolFile = {
  protocol_name: string;
  target_weight_kg?: number;
  max_weekly_loss_kg?: number;
  rest_day?: ProtocolDayMacros;
  training_day?: ProtocolDayMacros;
  pre_ride?: {
    timing_hours_before?: number;
    focus?: string;
    [key: string]: unknown;
  };
  on_bike?: {
    under_90min?: string;
    over_90min?: string;
    over_3hrs?: string;
    [key: string]: unknown;
  };
  post_ride?: {
    timing_minutes_after?: number;
    focus?: string;
    [key: string]: unknown;
  };
  race_week?: {
    strategy?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ValidationOk = { valid: true; data: ProtocolFile };
type ValidationFail = { valid: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function validateProtocol(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: "Protocol must be a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.protocol_name || typeof obj.protocol_name !== "string") {
    return {
      valid: false,
      error: 'Protocol must include a "protocol_name" string field.',
    };
  }

  if (obj.protocol_name.trim().length === 0) {
    return { valid: false, error: '"protocol_name" cannot be empty.' };
  }

  if (
    obj.target_weight_kg !== undefined &&
    typeof obj.target_weight_kg !== "number"
  ) {
    return {
      valid: false,
      error: '"target_weight_kg" must be a number if provided.',
    };
  }

  if (
    obj.max_weekly_loss_kg !== undefined &&
    typeof obj.max_weekly_loss_kg !== "number"
  ) {
    return {
      valid: false,
      error: '"max_weekly_loss_kg" must be a number if provided.',
    };
  }

  return { valid: true, data: obj as ProtocolFile };
}
