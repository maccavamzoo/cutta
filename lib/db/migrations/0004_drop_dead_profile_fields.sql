-- PR1: Drop 5 unused profile fields
-- Run this in the Neon SQL editor

ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "session_types";
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "usual_intensity";
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "training_time_preference";
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "training_environment";
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "usual_carb_intake_grams";
