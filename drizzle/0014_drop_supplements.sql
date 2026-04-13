-- Remove supplement-related columns.
ALTER TABLE user_profiles DROP COLUMN IF EXISTS current_supplements;
ALTER TABLE fuelling_plans DROP COLUMN IF EXISTS supplements;
ALTER TABLE feedback_log DROP COLUMN IF EXISTS tagged_supplement;
