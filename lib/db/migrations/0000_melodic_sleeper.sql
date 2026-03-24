CREATE TABLE "audio_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"audio_url" text,
	"transcript" text,
	"processed_data" jsonb,
	"processing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer,
	"distance_km" numeric(6, 2),
	"intensity" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"log_date" date NOT NULL,
	"compliance" varchar(10) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"plan_date" date,
	"feedback_type" varchar(50) NOT NULL,
	"rating" integer NOT NULL,
	"notes" text,
	"tagged_meal" varchar(255),
	"tagged_supplement" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"plan_date" date NOT NULL,
	"meal_name" varchar(255),
	"description" text,
	"calories" integer,
	"carbs_g" integer,
	"protein_g" integer,
	"fat_g" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuelling_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"plan_date" date NOT NULL,
	"calendar_event_id" integer,
	"meals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"on_bike_fuelling" jsonb,
	"supplements" jsonb,
	"total_calories" integer,
	"total_carbs_g" integer,
	"total_protein_g" integer,
	"total_fat_g" integer,
	"ai_reasoning" text,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"generated_for_start" date NOT NULL,
	"generated_for_end" date NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"calendar_event_id" integer,
	"source" varchar(50) NOT NULL,
	"screenshot_url" text,
	"activity_date" date NOT NULL,
	"duration_minutes" integer,
	"distance_km" numeric(6, 2),
	"avg_power_watts" integer,
	"avg_heart_rate" integer,
	"elevation_m" integer,
	"estimated_calories" integer,
	"extraction_confidence" integer,
	"extracted_data" jsonb,
	"corrections" jsonb,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"current_weight_kg" numeric(5, 2),
	"target_weight_kg" numeric(5, 2),
	"height_cm" integer,
	"age" integer,
	"sex" varchar(20),
	"estimated_maintenance_calories" integer,
	"usual_carb_intake_grams" integer,
	"typical_weekly_hours" numeric(4, 1),
	"session_types" text[],
	"usual_intensity" varchar(50),
	"fasted_training" boolean,
	"training_time_preference" varchar(20),
	"training_environment" varchar(20),
	"gut_sensitivity" text,
	"food_exclusions" text[],
	"current_supplements" text[],
	"appetite_profile" text,
	"preferred_meal_timing" text,
	"food_profile" jsonb,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "weight_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"weighed_at" timestamp DEFAULT now() NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fuelling_plans" ADD CONSTRAINT "fuelling_plans_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_log" ADD CONSTRAINT "training_log_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_notes_clerk_user_id_idx" ON "audio_notes" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "calendar_events_clerk_user_id_idx" ON "calendar_events" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "calendar_events_scheduled_at_idx" ON "calendar_events" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_log_user_date_idx" ON "compliance_log" USING btree ("clerk_user_id","log_date");--> statement-breakpoint
CREATE INDEX "feedback_log_clerk_user_id_idx" ON "feedback_log" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "feedback_log_plan_date_idx" ON "feedback_log" USING btree ("plan_date");--> statement-breakpoint
CREATE INDEX "food_log_clerk_user_id_idx" ON "food_log" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "food_log_plan_date_idx" ON "food_log" USING btree ("plan_date");--> statement-breakpoint
CREATE INDEX "fuelling_plans_clerk_user_id_idx" ON "fuelling_plans" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "fuelling_plans_plan_date_idx" ON "fuelling_plans" USING btree ("plan_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fuelling_plans_user_date_idx" ON "fuelling_plans" USING btree ("clerk_user_id","plan_date");--> statement-breakpoint
CREATE INDEX "protocols_clerk_user_id_idx" ON "protocols" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_clerk_user_id_idx" ON "shopping_lists" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "training_log_clerk_user_id_idx" ON "training_log" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "training_log_activity_date_idx" ON "training_log" USING btree ("activity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_clerk_user_id_idx" ON "user_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "weight_log_clerk_user_id_idx" ON "weight_log" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "weight_log_weighed_at_idx" ON "weight_log" USING btree ("weighed_at");