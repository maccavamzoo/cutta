-- Drop all old tables
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS compliance_log CASCADE;
DROP TABLE IF EXISTS training_log CASCADE;
DROP TABLE IF EXISTS weekly_strategies CASCADE;
DROP TABLE IF EXISTS weight_log CASCADE;
DROP TABLE IF EXISTS fuelling_plans CASCADE;
DROP TABLE IF EXISTS user_activity_types CASCADE;
DROP TABLE IF EXISTS feedback_log CASCADE;
DROP TABLE IF EXISTS protocols CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS food_logs CASCADE;
DROP TABLE IF EXISTS weigh_ins CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- v3 schema
CREATE TABLE user_profiles (
  clerk_user_id text PRIMARY KEY,
  weight_kg numeric(5,2) NOT NULL,
  height_cm numeric(5,1) NOT NULL,
  age int NOT NULL,
  sex text NOT NULL CHECK (sex IN ('m','f')),
  unit text NOT NULL DEFAULT 'metric' CHECK (unit IN ('metric','imperial')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE weigh_ins (
  id bigserial PRIMARY KEY,
  clerk_user_id text NOT NULL REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
  weight_kg numeric(5,2) NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  local_date date NOT NULL
);
CREATE UNIQUE INDEX weigh_ins_user_date ON weigh_ins(clerk_user_id, local_date);

CREATE TABLE food_logs (
  id bigserial PRIMARY KEY,
  clerk_user_id text NOT NULL REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
  label text NOT NULL,
  cals int NOT NULL,
  protein_g numeric(5,1) NOT NULL,
  carbs_g numeric(5,1) NOT NULL,
  fat_g numeric(5,1) NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  local_date date NOT NULL
);
CREATE INDEX food_logs_user_date ON food_logs(clerk_user_id, local_date);

CREATE TABLE activity_logs (
  id bigserial PRIMARY KEY,
  clerk_user_id text NOT NULL REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('ride','run','other')),
  duration_min int NOT NULL,
  intensity text NOT NULL CHECK (intensity IN ('easy','steady','hard')),
  cals int NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  local_date date NOT NULL
);
CREATE INDEX activity_logs_user_date ON activity_logs(clerk_user_id, local_date);
