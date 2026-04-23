-- 0020: Make weight_log the sole source of truth for user weight
-- Run in Neon SQL editor.
--
-- Behaviour change: every weigh-in (or settings "current weight" save) writes
-- to weight_log and triggers a maintenance-calorie recalculation. The recalc
-- mode is per-user and defaults to a 7-day rolling average so that daily
-- water/food jitter doesn't whipsaw the calorie target.
--
-- user_profiles.current_weight_kg is no longer read or written by the app.
-- It's left in place (nullable) and will be dropped in a follow-up cleanup
-- migration once we're confident nothing depends on it.

-- 1. Recalculation mode: 'latest' or 'rolling_7d' (default)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS maintenance_recalc_mode varchar(20) NOT NULL DEFAULT 'rolling_7d';

-- 2. Allow current_weight_kg to be NULL (no longer the source of truth)
ALTER TABLE user_profiles
  ALTER COLUMN current_weight_kg DROP NOT NULL;
