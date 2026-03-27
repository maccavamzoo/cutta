# Task: Add body stats to Edit Profile + auto-calculate maintenance calories

Read CLAUDE.md and CUTTA_PRD.md first. PR1 (removing dead fields) has already been merged.

## What and why
The edit profile page is missing body stats (current weight, height, age, sex) — they were collected during onboarding but never exposed for editing. If a user's weight changes, or they had a birthday, they can't update these and the maintenance calorie calculation goes stale. Also, maintenance calories are currently a raw number input which is meaningless to most users. It should be auto-calculated from their stats and only manually overridable if they know their actual TDEE.

## Changes

### 1. Add body stats to the profile edit form

In `app/settings/profile/ProfileEditView.tsx`:

Add these fields to the `ProfileData` interface and form state:
- `currentWeightKg` (number | null)
- `heightCm` (number | null)
- `age` (number | null)
- `sex` (string | null)

Render them as the **first section** of the form, labelled "Body stats":
- Current weight — number input with kg/lbs unit based on unitSystem
- Target weight — already exists, keep it here
- Height — number input (cm)
- Age — number input
- Sex — pill selector: Male / Female / Other

### 2. Replace maintenance calories input with auto-calculation

Remove the raw `estimatedMaintenanceCalories` text input.

Replace with a **derived display** that recalculates live as the user changes weight, height, age, sex, or weekly hours. Use Mifflin-St Jeor (same formula already in `OnboardingForm.tsx`):

```
BMR (male):   10 × weight + 6.25 × height − 5 × age + 5
BMR (female): 10 × weight + 6.25 × height − 5 × age − 161
BMR (other):  10 × weight + 6.25 × height − 5 × age − 78

Activity multiplier based on typicalWeeklyHours:
  <3hrs → 1.375
  3-6hrs → 1.55
  6-10hrs → 1.725
  10+hrs → 1.9
```

Display it as a prominent read-only value, e.g.:
```
Estimated daily maintenance
2,480 kcal
Calculated from your stats
```

Below it, add a small "Override manually →" toggle. When tapped, it reveals a number input pre-filled with the calculated value. If the user enters a value and saves, that override is stored. If they clear it, it reverts to auto-calculated.

Keep `estimatedMaintenanceCalories` in the DB schema as-is — it stores whichever value is active (auto or override).

### 3. Update the profile edit page server component

In `app/settings/profile/page.tsx`:

Add `currentWeightKg`, `heightCm`, `age`, `sex` to the DB select query and pass them through to the form component in the `initial` object.

### 4. Update the PATCH API route

In the API route that handles profile updates (likely `/app/api/user-profile/profile/route.ts`):

Accept `currentWeightKg`, `heightCm`, `age`, `sex` in the request body and save them to the DB. Continue accepting `estimatedMaintenanceCalories`.

### 5. Reorder the form sections

After this change the edit profile form sections should be:
1. **Body stats** — current weight, target weight, height, age, sex
2. **Daily energy** — auto-calculated maintenance cals (with override), typical weekly hours
3. **Training habits** — fasted training (yes/sometimes/no) — this is the only training field left after PR1
4. **Gut health & food** — gut sensitivity, food exclusions, current supplements
5. **Appetite & timing** — appetite profile, preferred meal timing

### 6. Build and PR
- Run `npm run build` and fix any errors
- Create a PR

## Reminders
- `.npmrc` with `legacy-peer-deps=true` is required
- Mobile-first — all inputs should work well at phone width
- Tailwind only, no separate CSS
- Default branch is `main`
