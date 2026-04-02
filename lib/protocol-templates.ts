import type { ProtocolFile } from "./protocol";

export const PROTOCOL_TEMPLATES: ProtocolFile[] = [
  {
    protocol_name: "Endurance Base",
    description:   "Steady training blocks — balanced fuelling for sustained energy",
    rest_day: {
      calorie_offset:    -400,
      add_training_burn: false,
      carbs_g_per_kg:    { min: 2,   max: 3   },
      protein_g_per_kg:  { min: 1.8, max: 2.0 },
      fat_g_per_kg:      { min: 1.0, max: 1.0 },
    },
    training_day: {
      calorie_offset:    -200,
      add_training_burn: true,
      carbs_g_per_kg:    { min: 5,   max: 7   },
      protein_g_per_kg:  { min: 1.8, max: 2.0 },
      fat_g_per_kg:      { min: 0.8, max: 0.8 },
    },
    pre_ride: {
      timing_hours_before: 3,
      focus: "High carb, low fibre, moderate protein",
    },
    on_bike: {
      under_90min_carbs_per_hour:  0,
      over_90min_carbs_per_hour:   { min: 40, max: 60 },
      over_3hrs_carbs_per_hour:    { min: 60, max: 80 },
    },
    post_ride: {
      timing_minutes_after: 30,
      focus:                "Protein and carbs within recovery window",
      protein_g_per_kg:     0.3,
      carbs_g_per_kg:       1.0,
    },
    race_week: {
      carb_load_days_before:       3,
      carb_load_g_per_kg:          { min: 8, max: 10 },
      race_morning_carbs_g_per_kg: 2.5,
      race_morning_hours_before:   3,
      strategy_notes: "Taper volume while maintaining intensity, carb load the final 3 days",
    },
  },

  {
    protocol_name: "Race Week",
    description:   "Taper and carb-load for peak race day performance",
    rest_day: {
      calorie_offset:    0,
      add_training_burn: false,
      carbs_g_per_kg:    { min: 5,   max: 6   },
      protein_g_per_kg:  { min: 1.6, max: 1.6 },
      fat_g_per_kg:      { min: 0.8, max: 0.8 },
    },
    training_day: {
      calorie_offset:    0,
      add_training_burn: true,
      carbs_g_per_kg:    { min: 8,   max: 10  },
      protein_g_per_kg:  { min: 1.6, max: 1.6 },
      fat_g_per_kg:      { min: 0.6, max: 0.6 },
    },
    pre_ride: {
      timing_hours_before: 3,
      focus: "High carb, low fibre, low fat — familiar foods only",
    },
    on_bike: {
      under_90min_carbs_per_hour:  35,
      over_90min_carbs_per_hour:   { min: 60, max: 90  },
      over_3hrs_carbs_per_hour:    { min: 80, max: 100 },
    },
    post_ride: {
      timing_minutes_after: 20,
      focus:                "Rapid glycogen replenishment",
      protein_g_per_kg:     0.3,
      carbs_g_per_kg:       1.2,
    },
    race_week: {
      carb_load_days_before:       3,
      carb_load_g_per_kg:          { min: 10, max: 12 },
      race_morning_carbs_g_per_kg: 3.0,
      race_morning_hours_before:   3,
      strategy_notes: "Days 1-3 taper with moderate carbs, days 4-6 carb load, race morning high carb familiar breakfast",
    },
  },

  {
    protocol_name: "Weight Loss",
    description:   "Calorie deficit while protecting training performance",
    rest_day: {
      calorie_offset:    -600,
      add_training_burn: false,
      carbs_g_per_kg:    { min: 2,   max: 2   },
      protein_g_per_kg:  { min: 2.0, max: 2.2 },
      fat_g_per_kg:      { min: 0.8, max: 0.8 },
    },
    training_day: {
      calorie_offset:    -200,
      add_training_burn: true,
      carbs_g_per_kg:    { min: 4,   max: 5   },
      protein_g_per_kg:  { min: 2.0, max: 2.2 },
      fat_g_per_kg:      { min: 0.7, max: 0.7 },
    },
    pre_ride: {
      timing_hours_before: 2.5,
      focus: "Moderate carb, prioritise protein to protect muscle",
    },
    on_bike: {
      under_90min_carbs_per_hour:  0,
      over_90min_carbs_per_hour:   { min: 30, max: 50 },
      over_3hrs_carbs_per_hour:    { min: 50, max: 70 },
    },
    post_ride: {
      timing_minutes_after: 30,
      focus:                "Protein priority within recovery window",
      protein_g_per_kg:     0.4,
      carbs_g_per_kg:       0.8,
    },
    race_week: {
      carb_load_days_before:       2,
      carb_load_g_per_kg:          { min: 8, max: 10 },
      race_morning_carbs_g_per_kg: 2.0,
      race_morning_hours_before:   3,
      strategy_notes: "Ease deficit in the 2 days before race, prioritise performance over loss",
    },
  },

  {
    protocol_name: "General Health",
    description:   "Balanced nutrition for wellbeing and moderate activity",
    rest_day: {
      calorie_offset:    -200,
      add_training_burn: false,
      carbs_g_per_kg:    { min: 3,   max: 4   },
      protein_g_per_kg:  { min: 1.6, max: 1.8 },
      fat_g_per_kg:      { min: 1.0, max: 1.0 },
    },
    training_day: {
      calorie_offset:    0,
      add_training_burn: true,
      carbs_g_per_kg:    { min: 4,   max: 6   },
      protein_g_per_kg:  { min: 1.6, max: 1.8 },
      fat_g_per_kg:      { min: 0.9, max: 0.9 },
    },
    pre_ride: {
      timing_hours_before: 2.5,
      focus: "Balanced meal — whole grains, lean protein, vegetables",
    },
    on_bike: {
      under_90min_carbs_per_hour:  0,
      over_90min_carbs_per_hour:   { min: 40, max: 50 },
      over_3hrs_carbs_per_hour:    { min: 50, max: 70 },
    },
    post_ride: {
      timing_minutes_after: 45,
      focus:                "Balanced recovery meal with whole foods",
      protein_g_per_kg:     0.3,
      carbs_g_per_kg:       1.0,
    },
    race_week: {
      carb_load_days_before:       2,
      carb_load_g_per_kg:          { min: 8, max: 10 },
      race_morning_carbs_g_per_kg: 2.5,
      race_morning_hours_before:   3,
      strategy_notes: "Increase carbs 2 days before, keep breakfast familiar and easily digestible",
    },
  },
];
