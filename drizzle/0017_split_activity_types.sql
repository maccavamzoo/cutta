-- 0017: Split activity types out of protocol JSONB into their own table,
--       and move rest-day macros into user_profiles.

-- 1. Add rest-day macro columns to user_profiles (default 3/2 from Default template)
ALTER TABLE user_profiles
  ADD COLUMN rest_day_carbs_g_per_kg  NUMERIC(4,1) NOT NULL DEFAULT 3,
  ADD COLUMN rest_day_protein_g_per_kg NUMERIC(4,1) NOT NULL DEFAULT 2;

-- 2. Create user_activity_types table
CREATE TABLE user_activity_types (
  id                        SERIAL PRIMARY KEY,
  clerk_user_id             VARCHAR(255) NOT NULL,
  name                      VARCHAR(255) NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  burn_rate_kcal_per_min    NUMERIC(5,1) NOT NULL DEFAULT 8,
  carbs_g_per_kg            NUMERIC(4,1) NOT NULL DEFAULT 5,
  protein_g_per_kg          NUMERIC(4,1) NOT NULL DEFAULT 1.8,
  pre_activity              JSONB NOT NULL DEFAULT '{"timing_hours_before":2,"focus":"Moderate carbs, low fibre"}',
  during_activity           JSONB DEFAULT '{"carbs_per_hour":40,"description":"Drink mix or gels"}',
  post_activity             JSONB NOT NULL DEFAULT '{"timing_minutes_after":30,"focus":"Protein and carbs for recovery","protein_g_per_kg":0.3,"carbs_g_per_kg":0.8}',
  default_duration_minutes  INTEGER NOT NULL DEFAULT 60,
  is_race                   BOOLEAN NOT NULL DEFAULT false,
  sort_order                INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_activity_types_clerk_user_id_idx ON user_activity_types (clerk_user_id);

-- 3. Seed a "Default" activity type for every existing user
INSERT INTO user_activity_types (clerk_user_id, name, description, sort_order)
SELECT clerk_user_id, 'Default', 'Moderate intensity activity', 0
FROM user_profiles;

-- 4. Backfill rest-day macros from active protocol where available
UPDATE user_profiles up
SET rest_day_carbs_g_per_kg   = (p.content->'rest_day'->>'carbs_g_per_kg')::NUMERIC,
    rest_day_protein_g_per_kg = (p.content->'rest_day'->>'protein_g_per_kg')::NUMERIC
FROM protocols p
WHERE p.clerk_user_id = up.clerk_user_id
  AND p.is_active = true
  AND p.content->'rest_day'->>'carbs_g_per_kg' IS NOT NULL;
