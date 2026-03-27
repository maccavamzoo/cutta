# Task: Remove 5 unused profile fields

Read CLAUDE.md and CUTTA_PRD.md first.

## What and why
Five fields on the user profile are either redundant (the same data exists on individual calendar events) or stale after day one. They add noise to the AI prompt without meaningfully changing the plan output. Remove them everywhere.

## Fields to remove
1. `sessionTypes` — redundant, each calendar event already has `eventType`
2. `usualIntensity` — redundant, each calendar event already has `intensity`
3. `trainingTimePreference` — redundant, each calendar event already has `scheduledAt`
4. `trainingEnvironment` — negligible effect on nutrition
5. `usualCarbIntakeGrams` — only useful day 1, immediately stale

## Where to remove them

### Database schema (`lib/db/schema.ts`)
Remove the 5 column definitions from the `userProfiles` table. Then generate the migration SQL to drop these columns. **Do not attempt to run the migration** — I'll run it in the Neon SQL editor. Just output the SQL I need to paste.

### AI prompt (`lib/ai/buildPlanPrompt.ts`)
Remove references to these 5 fields from the prompt template string.

### Profile edit form (`app/settings/profile/ProfileEditView.tsx`)
Remove the fields from the `ProfileData` interface, the form state, and the rendered UI. Remove `sessionTypes`, `usualIntensity`, `trainingTimePreference`, `trainingEnvironment` from the Training section. The Training section should only contain `typicalWeeklyHours` and `fastedTraining` after this change.

### Profile edit page (`app/settings/profile/page.tsx`)
Remove these fields from the DB select query and the `initial` object passed to the form.

### Onboarding form (`app/onboarding/OnboardingForm.tsx`)
Remove these fields from the `FormData` type, `INITIAL` state, step components (`StepTraining`, `StepTrainingHabits`, `StepCalorieBaseline`), `canAdvance()` validation, and the submit payload. Don't restructure the onboarding flow — just remove the dead fields. A later task will replace the onboarding entirely.

### API routes
- `/app/api/onboarding/route.ts` — remove from the insert payload
- `/app/api/user-profile/profile/route.ts` (or wherever the PATCH lives) — remove from the update payload and accepted body fields

### Cleanup
- Search the entire codebase for any remaining references to these 5 field names and remove them
- Run `npm run build` and fix any errors
- Create a PR

## Reminders
- `.npmrc` with `legacy-peer-deps=true` is required for builds
- Database migrations can't be run from sandbox — generate the SQL and tell me to run it in Neon
- Default branch is `main`
