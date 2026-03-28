ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "track_stool_health" boolean NOT NULL DEFAULT false;
