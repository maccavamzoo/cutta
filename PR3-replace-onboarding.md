# Task: Replace the 7-step onboarding wizard with the shared profile edit component

Read CLAUDE.md and CUTTA_PRD.md first. PR1 (dead field removal) and PR2 (body stats + auto-calc cals on edit profile) have already been merged.

## What and why
The onboarding flow is a 7-step wizard that collects exactly the same data as the edit profile page. It's redundant code that will drift out of sync. Replace it with the same component, just wrapped differently.

## Changes

### 1. Extract the profile form into a shared component

The profile form currently lives in `app/settings/profile/ProfileEditView.tsx`. Refactor it so it can be used in two contexts:

It should accept these props:
- `initial: ProfileData` — pre-filled values (empty defaults for onboarding, DB values for edit)
- `unitSystem: UnitSystem`
- `mode: "onboarding" | "edit"` — controls header, button label, and post-save behaviour

**Onboarding mode:**
- No back arrow / settings link at the top
- Header: "Welcome to Cutta" / subtitle: "Set up your profile to get your first fuelling plan"
- Submit button label: "Get started →"
- On save: POST to `/api/onboarding` (which should set `onboardingComplete: true`), then redirect to `/dashboard`

**Edit mode (existing behaviour):**
- Header: "Edit profile" with back link to settings
- Submit button label: "Save changes"
- On save: PATCH to `/api/user-profile/profile`, show "saved" confirmation, stay on page

The form itself — all sections, fields, validation, auto-calc logic — is identical in both modes. One component, one source of truth.

### 2. Update the onboarding page

Replace `app/onboarding/page.tsx` to use the shared component in onboarding mode. Delete the old `app/onboarding/OnboardingForm.tsx` entirely.

The onboarding page should:
- Check auth (redirect to `/sign-in` if not logged in)
- Check if onboarding is already complete (redirect to `/dashboard` if so)
- Render the shared profile form with `mode="onboarding"` and empty initial values
- No bottom nav (onboarding shouldn't show the app nav)

### 3. Update the onboarding API route

`/app/api/onboarding/route.ts` should accept the same fields as the profile PATCH route. Make sure it:
- Creates the `user_profiles` row with all submitted fields
- Sets `onboardingComplete: true`
- Computes and saves `estimatedMaintenanceCalories` using the same Mifflin-St Jeor formula if no manual override was provided

### 4. Update the edit profile page

`app/settings/profile/page.tsx` should use the shared component with `mode="edit"`, pre-filled from the DB, with bottom nav visible.

### 5. Build and PR
- Delete `app/onboarding/OnboardingForm.tsx`
- Run `npm run build` and fix any errors
- Create a PR

## Reminders
- `.npmrc` with `legacy-peer-deps=true` is required
- Mobile-first design
- Tailwind only
- Default branch is `main`
