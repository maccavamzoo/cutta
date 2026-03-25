# CLAUDE.md — Cutta

## What is this project?

Cutta is an AI-powered performance fuelling system for endurance cyclists. It tells the user what to eat, when, and how much — based on their training schedule, body profile, and a user-defined protocol file. See `CUTTA_PRD.md` in the repo root for the full product spec.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Database**: Vercel Postgres (Neon), London region, free tier
- **ORM**: Drizzle ORM — schema in `lib/db/schema.ts`
- **Auth**: Clerk (v6, Google + email sign-in)
- **AI**: Claude API via Anthropic TypeScript SDK (`@anthropic-ai/sdk`), model: `claude-sonnet-4-20250514`
- **PWA**: @ducanh2912/next-pwa — configured in `next.config.mjs`
- **Delivery**: PWA (mobile-first)

## Current State — MVP Complete

All 12 MVP tasks are built and deployed:

1. ✅ **Project scaffolding + PWA** — Next.js 14, App Router, TypeScript, Tailwind, PWA manifest, service worker, placeholder icons
2. ✅ **Auth** — Clerk v6, ClerkProvider, middleware protecting all routes, sign-in/sign-up pages, UserButton
3. ✅ **Database schema** — 11 tables defined via Drizzle ORM in `lib/db/schema.ts`, migrations applied via Neon SQL editor
4. ✅ **Onboarding flow** — 7-step wizard collecting baseline data, saves to user_profiles table, routing logic redirects new users to /onboarding
5. ✅ **Protocol upload** — JSON protocol file upload, validation, stored in protocols table. Active protocol shown at /settings/protocol. Validation lib at `lib/protocol.ts`
6. ✅ **Calendar view** — Week view (default) with day view. Add training sessions via bottom sheet. Nav arrows, event-coloured dots, FAB for adding events
7. ✅ **Training screenshot input** — Upload Strava/Rouvy screenshots at /training/upload. 4-stage flow: pick source → AI extracts via Claude vision → review with confidence indicators and editable fields → confirm and save to training_log
8. ✅ **Fuelling plan generation** — Generates 3-day rolling plan (not 14 — timeout constraint). Sends profile + protocol + calendar + recent training to Claude API. Named meal templates, on-bike fuelling, supplements, calorie reasoning, glycogen battery. "Generate next 3 days" button to extend. Prompt builder at `lib/ai/buildPlanPrompt.ts`
9. ✅ **Daily dashboard** — /dashboard is the home screen. Glycogen battery (5-segment colour bar), AI reasoning, macro summary, session fuelling hero, meals as expandable cards, supplements, check-in card, shopping list quick-link
10. ✅ **Feedback + compliance** — Daily compliance check-in (yes/mostly/no) and three feedback signals: ride energy, gut comfort, hunger (1-5). Bottom sheet from dashboard. Pre-fills from previously saved data
11. ✅ **Audio notes** — /audio page with full-screen recorder. Large mic button, live transcript via SpeechRecognition API, sends to Claude for structured extraction (summary, tags, energy, gut, symptoms, foods, sentiment, action items). Note history with collapsible cards
12. ✅ **Shopping list** — /shopping page. Auto-generates from next 3 days of fuelling plans. Deduplicates and sums ingredients. 7 colour-coded categories. Tap to tick off items. Progress bar. Regenerate button

## Known Issues & Things to Revisit

### Needs fixing/improving
- **Onboarding is too complex** — 7 steps feels like too many. Simplify later
- **Training upload source toggle** — Strava/Rouvy toggle is probably unnecessary, Claude vision can read any screenshot. Remove toggle, just accept any image
- **Training log ↔ calendar linking** — when uploading actual training data, it should clearly replace the planned calendar entry. The "Link to a session" option exists but the AI plan generation needs to prioritise real data over planned estimates
- **Fuelling plan is 3 days not 14** — Vercel timeout constraint. Days beyond 3 show planned training and rough calorie targets but no specific meals. User can extend with "Generate next 3 days" button

### Future features (post-MVP)
- Weight projection graph (simple maths, not AI — based on deficit and weight log)
- Expanded projections (performance, glycogen trends over time)
- Food photo analysis
- Sleep/stress tracking as structured inputs
- Long-term calendar trajectory view
- Multiple protocol files for season phases
- Expanded feedback dimensions
- Advanced profile learning (pattern detection across weeks/months)
- Energy availability guardrail (internal, not user-facing — RED-S prevention)

## Project Structure

```
/app                          → Next.js App Router pages and layouts
/app/api                      → API routes
/app/api/calendar/route.ts    → GET/POST calendar events
/app/api/compliance/route.ts  → GET/POST daily compliance signal
/app/api/feedback/route.ts    → GET/POST feedback ratings
/app/api/protocol/route.ts    → GET/POST protocols
/app/api/training-log/extract/route.ts → POST screenshot to Claude vision
/app/api/training-log/route.ts → POST confirmed training data
/app/api/fuelling-plan/generate/route.ts → POST generate 3-day plan via Claude
/app/api/audio-notes/route.ts → GET/POST audio notes with Claude processing
/app/api/shopping-list/route.ts → POST generate shopping list from plans
/app/audio                    → Audio note recorder and history
/app/calendar                 → Calendar week/day views, add event sheet
/app/dashboard                → Daily dashboard (home screen)
/app/onboarding               → 7-step onboarding wizard
/app/plan                     → Fuelling plan viewer with generate button
/app/settings/protocol        → Protocol upload and viewer
/app/shopping                 → Shopping list with tick-off
/app/sign-in                  → Clerk sign-in page
/app/sign-up                  → Clerk sign-up page
/app/training/upload          → Training screenshot upload flow
/components                   → Reusable UI components
/components/BottomNav.tsx     → Shared fixed bottom nav (Today/Calendar/Plan/Notes/Shop)
/lib                          → Utility functions
/lib/ai/buildPlanPrompt.ts    → Prompt builder for fuelling plan generation
/lib/db                       → Database connection, schema, migrations
/lib/db/schema.ts             → Drizzle ORM schema (11 tables)
/lib/db/migrations/           → Generated SQL migration files
/lib/protocol.ts              → Protocol type + validation
/public                       → Static assets, PWA icons, manifest
```

## Database Tables (11 total)

All tables use `clerk_user_id varchar(255)` as the user scoping column:

- `user_profiles` — stats, body, training habits, food profile, onboarding flag
- `protocols` — JSON rulebook files; multiple allowed, one `is_active`
- `calendar_events` — training sessions, races, rest days
- `fuelling_plans` — AI-generated daily plans (meals, on-bike fuelling, supplements, macros, reasoning, glycogen_battery integer)
- `food_log` — actual food eaten when it differs from the plan
- `compliance_log` — daily yes/mostly/no signal
- `feedback_log` — ride_energy / gut_comfort / hunger ratings (1-5)
- `training_log` — screenshot extraction output, confidence score, corrections, linked to calendar events
- `audio_notes` — transcript, AI-processed structured data (summary, tags, energy, gut, symptoms, foods, sentiment, action items)
- `weight_log` — weigh-in entries with timestamps
- `shopping_lists` — aggregated ingredient lists covering a date range, 7 categories

## Key Conventions

- All components use TypeScript
- Use Tailwind CSS for styling — no separate CSS files
- Mobile-first design — build for phone screens, scale up
- Server components by default, client components only when needed (interactivity, state)
- API routes handle all Claude API calls server-side (never expose API keys to client)
- Use environment variables for all secrets
- When creating PRs, always target the `main` branch
- **Always create a PR when a task is complete** — don't just push to branch without creating a PR
- Bottom nav has 5 tabs: Today / Calendar / Plan / Notes / Shop

## Known Gotchas

- **`.npmrc` with `legacy-peer-deps=true`** is required — Clerk v6 has peer dependency conflict. Without this file, Vercel builds fail
- **Claude Code cloud sandbox cannot connect to Neon** — outbound network blocked. Database migrations/schema changes must be applied manually via the Neon SQL editor. When a schema change is needed, generate the SQL and tell the user to run it in Neon
- **Drizzle-kit does not auto-load `.env.local`** — if running db commands, pass DATABASE_URL inline
- **Clerk redirect loop** — happens if the CLERK_SIGN_IN_URL / SIGN_UP_URL / AFTER_SIGN_IN_URL / AFTER_SIGN_UP_URL env vars are missing in Vercel
- **Anthropic SDK must be instantiated inside the handler** — not at module level, otherwise it crashes on Vercel when env vars aren't in .env.local
- **Fuelling plan generation timeout** — Vercel hobby plan has 60s function limit. 14-day generation times out. Currently generates 3 days at a time
- **Default branch is `main`** — Vercel production tracks `main`

## Environment Variables (all set in Vercel)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  (set)
CLERK_SECRET_KEY=                   (set)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=      /sign-in (set)
NEXT_PUBLIC_CLERK_SIGN_UP_URL=      /sign-up (set)
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=  / (set)
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=  / (set)
DATABASE_URL=                       (set via Neon integration)
ANTHROPIC_API_KEY=                  (set)
```

## Commands

```bash
npm run dev       # Local development
npm run build     # Production build
npm run lint      # Lint check
npm run db:push   # Push schema to Neon (needs DATABASE_URL — cannot run from sandbox)
npm run db:generate  # Generate migration SQL files
```

## Important Notes

- Always read `CUTTA_PRD.md` before starting any task — it contains the full product spec, recommendation hierarchy, AI behaviour rules, and success/failure criteria
- This is a single-user personal app — no multi-tenancy needed
- Mobile-first PWA — always test layouts at phone width
- The AI is prescriptive, not reactive — it tells the user what to eat, it doesn't just track what they ate
- Fuelling wraps around training — rides are the anchors, meals support them
- Database migrations cannot be run from Claude Code cloud sandbox — generate the SQL and tell the user to run it in the Neon SQL editor
- Always ensure builds pass before committing (`npm run build`)
- Always create a PR at the end of each task
- When actual training data exists (from screenshots), it should take priority over planned calendar estimates in plan generation
