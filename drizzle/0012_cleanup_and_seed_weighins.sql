-- 0012: Drop deprecated columns + seed a week of weigh-ins
-- Run in Neon SQL editor

-- ─── 1. Drop deprecated columns ─────────────────────────────────────────────
-- fastedTraining: never used in plan generation or AI prompts
-- typicalWeeklyHours: replaced by calendar event-based activity burn
-- preferredMealTiming: superseded by appetiteProfile
-- foodProfile: all data migrated to flat columns preferred_foods and food_exclusions
-- gutSensitivity: redundant with food_exclusions (specific triggers more useful than low/medium/high)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS fasted_training;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS typical_weekly_hours;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS preferred_meal_timing;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS food_profile;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS gut_sensitivity;

-- ─── 2. Reset old-format appetite_profile ────────────────────────────────────
-- New format is "Meal pattern[, Done eating by 7pm]".
-- Old multi-select values won't parse — NULL them so the UI defaults cleanly.
UPDATE user_profiles
SET appetite_profile = NULL
WHERE appetite_profile IS NOT NULL;

-- ─── 3. Seed a week of weigh-ins (Apr 7–13 2026) ────────────────────────────
-- Starting ~79 kg, natural daily fluctuations, moderate downward trend.
-- Uses the single existing user's clerk_user_id.
INSERT INTO weight_log (clerk_user_id, log_date, weighed_at, weight_kg)
SELECT
  p.clerk_user_id,
  d.log_date,
  d.log_date::timestamp + interval '7 hours 15 minutes',
  d.weight_kg
FROM user_profiles p
CROSS JOIN (VALUES
  ('2026-04-07'::date, 79.0),
  ('2026-04-08'::date, 78.8),
  ('2026-04-09'::date, 79.1),
  ('2026-04-10'::date, 78.6),
  ('2026-04-11'::date, 78.4),
  ('2026-04-12'::date, 78.7),
  ('2026-04-13'::date, 78.3)
) AS d(log_date, weight_kg)
WHERE p.onboarding_complete = true
ON CONFLICT (clerk_user_id, log_date)
  DO UPDATE SET weight_kg = EXCLUDED.weight_kg,
               weighed_at = EXCLUDED.weighed_at;

-- ─── 4. Sync profile current weight to latest weigh-in ──────────────────────
UPDATE user_profiles
SET current_weight_kg = 78.3,
    updated_at = now()
WHERE onboarding_complete = true;
