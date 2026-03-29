ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(100);
