ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "weight_loss_rate" varchar(20),
  ADD COLUMN IF NOT EXISTS "target_set_at" timestamp;
