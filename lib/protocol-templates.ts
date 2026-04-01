import type { ProtocolFile } from "./protocol";

export const PROTOCOL_TEMPLATES: ProtocolFile[] = [
  {
    protocol_name: "Endurance Base",
    description:   "Steady training blocks — balanced fuelling for sustained energy",
    rest_day: {
      calories: "maintenance - 400",
      carbs:    "2-3g/kg",
      protein:  "1.8-2.0g/kg",
      fat:      "1g/kg",
    },
    training_day: {
      calories: "maintenance + training burn - 200",
      carbs:    "5-7g/kg",
      protein:  "1.8-2.0g/kg",
      fat:      "0.8g/kg",
    },
    pre_ride: {
      timing_hours_before: 3,
      focus: "High carb, low fibre, moderate protein",
    },
    on_bike: {
      under_90min: "Water and electrolytes only",
      over_90min:  "40-60g carbs/hr from mix of drink and solid",
      over_3hrs:   "60-80g carbs/hr, alternate gels and bars every 20min",
    },
    post_ride: {
      timing_minutes_after: 30,
      focus: "0.3g/kg protein + 1g/kg carbs within recovery window",
    },
  },

  {
    protocol_name: "Race Week",
    description:   "Taper and carb-load for peak race day performance",
    rest_day: {
      calories: "maintenance",
      carbs:    "5-6g/kg",
      protein:  "1.6g/kg",
      fat:      "0.8g/kg",
    },
    training_day: {
      calories: "maintenance + training burn",
      carbs:    "8-10g/kg",
      protein:  "1.6g/kg",
      fat:      "0.6g/kg",
    },
    pre_ride: {
      timing_hours_before: 3,
      focus: "High carb, low fibre, low fat — familiar foods only",
    },
    on_bike: {
      under_90min: "30-40g carbs/hr",
      over_90min:  "60-90g carbs/hr, practised race nutrition only",
      over_3hrs:   "80-100g carbs/hr, dual-source glucose:fructose",
    },
    post_ride: {
      timing_minutes_after: 20,
      focus: "Rapid glycogen replenishment — 1.2g/kg carbs + 0.3g/kg protein",
    },
    race_week: {
      strategy: "Days 1-3 taper with moderate carbs, days 4-6 carb load at 10-12g/kg, race morning 2-3g/kg 3hrs before start",
    },
  },

  {
    protocol_name: "Weight Loss",
    description:   "Calorie deficit while protecting training performance",
    rest_day: {
      calories: "maintenance - 600",
      carbs:    "2g/kg",
      protein:  "2.0-2.2g/kg",
      fat:      "0.8g/kg",
    },
    training_day: {
      calories: "maintenance - 200",
      carbs:    "4-5g/kg",
      protein:  "2.0-2.2g/kg",
      fat:      "0.7g/kg",
    },
    pre_ride: {
      timing_hours_before: 2.5,
      focus: "Moderate carb, prioritise protein to protect muscle",
    },
    on_bike: {
      under_90min: "Water and electrolytes, consider fasted for easy rides",
      over_90min:  "30-50g carbs/hr — fuel the work, not the rest",
      over_3hrs:   "50-70g carbs/hr",
    },
    post_ride: {
      timing_minutes_after: 30,
      focus: "Protein priority — 0.4g/kg protein + moderate carbs",
    },
  },

  {
    protocol_name: "General Health",
    description:   "Balanced nutrition for wellbeing and moderate activity",
    rest_day: {
      calories: "maintenance - 200",
      carbs:    "3-4g/kg",
      protein:  "1.6-1.8g/kg",
      fat:      "1g/kg",
    },
    training_day: {
      calories: "maintenance + training burn",
      carbs:    "4-6g/kg",
      protein:  "1.6-1.8g/kg",
      fat:      "0.9g/kg",
    },
    pre_ride: {
      timing_hours_before: 2.5,
      focus: "Balanced meal — whole grains, lean protein, vegetables",
    },
    on_bike: {
      under_90min: "Water and electrolytes",
      over_90min:  "40-50g carbs/hr from whole food sources where possible",
      over_3hrs:   "50-70g carbs/hr",
    },
    post_ride: {
      timing_minutes_after: 45,
      focus: "Balanced recovery meal with whole foods — protein, carbs, vegetables",
    },
  },
];
