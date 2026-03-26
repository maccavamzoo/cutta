-- Add log_date column to weight_log for one-entry-per-user-per-day upsert
ALTER TABLE "weight_log" ADD COLUMN IF NOT EXISTS "log_date" date;

-- Back-fill from existing rows
UPDATE "weight_log" SET "log_date" = DATE("weighed_at") WHERE "log_date" IS NULL;

-- Set NOT NULL after back-fill
ALTER TABLE "weight_log" ALTER COLUMN "log_date" SET NOT NULL;

-- Unique constraint: one weigh-in per user per day
-- Keep only the most-recent entry per (user, date) if duplicates already exist
DELETE FROM "weight_log" a
USING "weight_log" b
WHERE a."clerk_user_id" = b."clerk_user_id"
  AND a."log_date"      = b."log_date"
  AND a."id"            < b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "weight_log_user_date_idx"
  ON "weight_log"("clerk_user_id", "log_date");
