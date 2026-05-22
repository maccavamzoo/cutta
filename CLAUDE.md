# CLAUDE.md

Cutta v3 — reactive cal tracker for endurance cyclists. No planning.

## Stack

- Next.js 14 App Router, TypeScript strict
- Tailwind CSS
- Neon Postgres (`@neondatabase/serverless`) via `DATABASE_URL`
- Clerk v7 auth
- Anthropic SDK for food photo analysis
- Deployed on Vercel

## Schema

Migration: `/migrations/001_v3_reset.sql` — run manually in Neon SQL editor.
Tables: `user_profiles`, `weigh_ins`, `food_logs`, `activity_logs`.

## Architecture

- `lib/maths.ts` owns all nutrition arithmetic — pure, deterministic, no AI, no DB.
- Claude only identifies food in photos. It never does arithmetic.
- All calorie/macro maths lives in the client via `lib/maths.ts` imports.

## Constraints

- Anthropic SDK instantiated **inside** route handlers only — never at module top.
- No date libraries — native `Intl`/`Date` only.
- `window.location.href` for post-save navigation where router refresh is needed, not `router.push`.
- `HomeView` and `SetupView` imported with `ssr: false`.
- Migrations are manual. Ben runs them in the Neon SQL editor. Claude Code cannot connect to the DB.
- No `beforeunload` on any form.
- `.npmrc` has `legacy-peer-deps=true` — respect it.
- Terminology: "cals left", "log", "weigh-in" — never "track", "feed", "diary".
- No local dev environment. Ben works browser-only: GitHub web editor + Claude Code.
- Default branch: `main`.

## Maths (Mifflin-St Jeor)

```
bmr_male   = 10*kg + 6.25*cm - 5*age + 5
bmr_female = 10*kg + 6.25*cm - 5*age - 161
target_cals = round(bmr * 1.4) - 400
protein_g = round(1.8 * kg)
fat_g     = round((target_cals * 0.28) / 9)
carbs_g   = round((target_cals - protein_g*4 - fat_g*9) / 4)
cals_left = target_cals + sum(activity.cals) - sum(food.cals)
activity_cals = round(mets * kg * (duration_min / 60))
mets = { easy: 5, steady: 8, hard: 12 }[intensity]
```
