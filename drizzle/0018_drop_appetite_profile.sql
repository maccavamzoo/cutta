-- Drop unused appetite_profile column from user_profiles
-- This column stored comma-joined eating style pills (e.g. "3 big meals, no snacking")
-- but was never exposed in the UI and is no longer read by the plan engine.

ALTER TABLE user_profiles DROP COLUMN IF EXISTS appetite_profile;
