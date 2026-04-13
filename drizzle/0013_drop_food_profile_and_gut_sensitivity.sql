-- Drop deprecated columns from user_profiles.
-- food_profile: all data migrated to flat columns preferred_foods and food_exclusions.
-- gut_sensitivity: redundant with food_exclusions (specific triggers are more useful than low/medium/high).
ALTER TABLE user_profiles DROP COLUMN IF EXISTS food_profile;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS gut_sensitivity;
