import type { ProtocolFile } from "./protocol";

export const PROTOCOL_TEMPLATES: ProtocolFile[] = [
  {
    protocol_name: "Default",
    description: "Balanced endurance fuelling for cycling training and weight management",
    rest_day: {
      carbs_g_per_kg: 3,
      protein_g_per_kg: 2,
    },
    activity_types: [
      {
        name: "Default",
        description: "Moderate intensity activity",
        burn_rate_kcal_per_min: 8,
        carbs_g_per_kg: 5,
        protein_g_per_kg: 1.8,
        pre_activity: { timing_hours_before: 2, focus: "Moderate carbs, low fibre" },
        during_activity: { carbs_per_hour: 40, description: "40g carbs per hour — drink mix or gels" },
        post_activity: { timing_minutes_after: 30, focus: "Protein and carbs for recovery", protein_g_per_kg: 0.3, carbs_g_per_kg: 0.8 },
        default_duration_minutes: 60,
        is_race: false,
      },
    ],
  },
];
