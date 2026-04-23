-- Drop all remaining deprecated columns and the deprecated protocols table.
-- None of these are referenced anywhere in the app code. IF EXISTS is used
-- because some were already dropped by earlier migrations (0014, 0018) — this
-- file is safe to run regardless of current DB state.

ALTER TABLE user_profiles DROP COLUMN IF EXISTS fasted_training;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS food_profile;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS gut_sensitivity;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS preferred_meal_timing;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS typical_weekly_hours;

-- Idempotent drops for columns already handled in earlier migrations.
ALTER TABLE user_profiles DROP COLUMN IF EXISTS appetite_profile;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS current_supplements;
ALTER TABLE fuelling_plans DROP COLUMN IF EXISTS supplements;
ALTER TABLE feedback_log DROP COLUMN IF EXISTS tagged_supplement;

DROP TABLE IF EXISTS protocols;
