export function calcBMR(weightKg: number, heightCm: number, age: number, sex: 'm' | 'f'): number {
  if (sex === 'm') return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function calcTargetCals(bmr: number): number {
  return Math.round(bmr * 1.4) - 400;
}

export function calcMacroTargets(targetCals: number, weightKg: number) {
  const protein_g = Math.round(1.8 * weightKg);
  const fat_g = Math.round((targetCals * 0.28) / 9);
  const carbs_g = Math.round((targetCals - protein_g * 4 - fat_g * 9) / 4);
  return { protein_g, fat_g, carbs_g };
}

export function calcActivityCals(
  intensity: 'easy' | 'steady' | 'hard',
  weightKg: number,
  durationMin: number,
): number {
  const mets = { easy: 5, steady: 8, hard: 12 }[intensity];
  return Math.round(mets * weightKg * (durationMin / 60));
}
