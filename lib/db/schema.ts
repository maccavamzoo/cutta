import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// User Profile
// Personal stats, goals, food tolerances, preferences, training habits.
// One row per Clerk user.
// ---------------------------------------------------------------------------
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),

    // Body stats
    currentWeightKg: numeric("current_weight_kg", { precision: 5, scale: 2 }),
    targetWeightKg: numeric("target_weight_kg", { precision: 5, scale: 2 }),
    heightCm: integer("height_cm"),
    age: integer("age"),
    sex: varchar("sex", { length: 20 }),

    // Calorie baseline
    estimatedMaintenanceCalories: integer("estimated_maintenance_calories"),

    // Diet & gut
    trackStoolHealth: boolean("track_stool_health").default(false).notNull(),
    foodExclusions: text("food_exclusions").array(),
    preferredFoods: text("preferred_foods").array(),

    // Appetite & timing preferences
    appetiteProfile: text("appetite_profile"),

    // Display preferences
    unitSystem: varchar("unit_system", { length: 10 }).default("metric"),
    timezone: varchar("timezone", { length: 100 }),

    // Weight goal
    weightLossRate: varchar("weight_loss_rate", { length: 20 }),
    targetSetAt: timestamp("target_set_at"),

    // Onboarding complete flag
    onboardingComplete: boolean("onboarding_complete").default(false).notNull(),

    // Advisor chat history — array of { role: "user"|"assistant", content: string }
    advisorChatHistory: jsonb("advisor_chat_history"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: uniqueIndex("user_profiles_clerk_user_id_idx").on(
      t.clerkUserId
    ),
  })
);

// ---------------------------------------------------------------------------
// Protocols
// User-defined fuelling rulebook (JSON). Multiple allowed; one is active.
// ---------------------------------------------------------------------------
export const protocols = pgTable(
  "protocols",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    content: jsonb("content").notNull(), // validated against ProtocolFile shape
    isActive: boolean("is_active").default(false).notNull(),
    isTemplate: boolean("is_template").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("protocols_clerk_user_id_idx").on(t.clerkUserId),
  })
);

// ---------------------------------------------------------------------------
// Calendar Events
// Upcoming training sessions, races, and other events.
// ---------------------------------------------------------------------------
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(), // ride | race | rest | other
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes"),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    intensity: varchar("intensity", { length: 50 }), // easy | moderate | hard | race
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("calendar_events_clerk_user_id_idx").on(
      t.clerkUserId
    ),
    scheduledAtIdx: index("calendar_events_scheduled_at_idx").on(
      t.scheduledAt
    ),
  })
);

// ---------------------------------------------------------------------------
// Fuelling Plans
// AI-generated daily plans. One row per day.
// meals and onBikeFuelling are arrays of structured objects.
// ---------------------------------------------------------------------------
export const fuellingPlans = pgTable(
  "fuelling_plans",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    planDate: date("plan_date").notNull(),
    calendarEventId: integer("calendar_event_id").references(
      () => calendarEvents.id,
      { onDelete: "set null" }
    ),

    // Array of { name, timing, ingredients: [{ item, grams }] }
    meals: jsonb("meals").notNull().default([]),
    // { pre: {...}, onBike: {...}, post: {...} }
    onBikeFuelling: jsonb("on_bike_fuelling"),

    // Macro totals
    totalCalories: integer("total_calories"),
    totalCarbsG: integer("total_carbs_g"),
    totalProteinG: integer("total_protein_g"),
    totalFatG: integer("total_fat_g"),

    // Short explanation of the AI's reasoning for this day's plan
    aiReasoning: text("ai_reasoning"),

    // Estimated glycogen level 0–100 (displayed as battery on dashboard)
    glycogenBattery: integer("glycogen_battery"),

    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("fuelling_plans_clerk_user_id_idx").on(
      t.clerkUserId
    ),
    planDateIdx: index("fuelling_plans_plan_date_idx").on(t.planDate),
    // Enforce one plan per user per day
    uniquePlanPerDay: uniqueIndex("fuelling_plans_user_date_idx").on(
      t.clerkUserId,
      t.planDate
    ),
  })
);


// ---------------------------------------------------------------------------
// Compliance Log
// Daily yes/mostly/no check-in signal.
// ---------------------------------------------------------------------------
export const complianceLog = pgTable(
  "compliance_log",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    logDate: date("log_date").notNull(),
    compliance: varchar("compliance", { length: 10 }).notNull(), // yes | mostly | no
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // One entry per user per day
    uniquePerDay: uniqueIndex("compliance_log_user_date_idx").on(
      t.clerkUserId,
      t.logDate
    ),
  })
);

// ---------------------------------------------------------------------------
// Feedback Log
// Three focused signals: ride_energy | gut_comfort | hunger.
// ---------------------------------------------------------------------------
export const feedbackLog = pgTable(
  "feedback_log",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    loggedAt: timestamp("logged_at").defaultNow().notNull(),
    planDate: date("plan_date"),
    feedbackType: varchar("feedback_type", { length: 50 }).notNull(), // ride_energy | gut_comfort | hunger
    rating: integer("rating").notNull(), // 1 (poor) – 5 (excellent)
    notes: text("notes"),

    // Optional tag to link signal to a specific meal
    taggedMeal: varchar("tagged_meal", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("feedback_log_clerk_user_id_idx").on(t.clerkUserId),
    planDateIdx: index("feedback_log_plan_date_idx").on(t.planDate),
  })
);

// ---------------------------------------------------------------------------
// Training Log
// Data extracted from Strava/Rouvy screenshots, with correction history.
// ---------------------------------------------------------------------------
export const trainingLog = pgTable(
  "training_log",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    calendarEventId: integer("calendar_event_id").references(
      () => calendarEvents.id,
      { onDelete: "set null" }
    ),

    source: varchar("source", { length: 50 }).notNull(), // strava | rouvy
    screenshotUrl: text("screenshot_url"),
    activityDate: date("activity_date").notNull(),

    // Extracted fields
    durationMinutes: integer("duration_minutes"),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    avgPowerWatts: integer("avg_power_watts"),
    avgHeartRate: integer("avg_heart_rate"),
    elevationM: integer("elevation_m"),
    estimatedCalories: integer("estimated_calories"),

    // AI extraction metadata
    extractionConfidence: integer("extraction_confidence"), // 0–100
    extractedData: jsonb("extracted_data"), // raw AI output before user confirmation
    corrections: jsonb("corrections"), // { field: { original, corrected } }
    confirmed: boolean("confirmed").default(false).notNull(),

    // Post-ride subjective effort (bimble | easy | moderate | hard | very hard)
    perceivedEffort: varchar("perceived_effort", { length: 20 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("training_log_clerk_user_id_idx").on(t.clerkUserId),
    activityDateIdx: index("training_log_activity_date_idx").on(
      t.activityDate
    ),
  })
);


// ---------------------------------------------------------------------------
// Weight Log
// Regular weigh-in entries for body composition tracking.
// ---------------------------------------------------------------------------
export const weightLog = pgTable(
  "weight_log",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    logDate: date("log_date").notNull(),
    weighedAt: timestamp("weighed_at").defaultNow().notNull(),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
    bodyFatPct: numeric("body_fat_pct", { precision: 4, scale: 1 }),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("weight_log_clerk_user_id_idx").on(t.clerkUserId),
    weighedAtIdx: index("weight_log_weighed_at_idx").on(t.weighedAt),
    uniquePerDay: uniqueIndex("weight_log_user_date_idx").on(t.clerkUserId, t.logDate),
  })
);

// ---------------------------------------------------------------------------
// Weekly Strategies
// User's agreed ingredient pool + shopping list for the week.
// One active strategy at a time; others retained as history.
// ---------------------------------------------------------------------------
export const weeklyStrategies = pgTable(
  "weekly_strategies",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    weekOverview: text("week_overview"),

    // Array of ingredient name strings fed into daily plan generation
    ingredientPool: jsonb("ingredient_pool").notNull().default([]),

    // Array of { item: string, category: string, amount: string }
    shoppingItems: jsonb("shopping_items").notNull().default([]),

    // Pending AI-proposed changes awaiting user confirmation
    // { ingredientPool?: string[], shoppingItems?: ShoppingItem[] }
    proposedUpdate: jsonb("proposed_update"),

    aiReasoning: text("ai_reasoning"),
    isActive: boolean("is_active").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdIdx: index("weekly_strategies_clerk_user_id_idx").on(
      t.clerkUserId
    ),
  })
);

