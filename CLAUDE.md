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
- **Charts**: Recharts (used on Progress page)
- **Delivery**: PWA (mobile-first)

## Current State — MVP Complete + Refinement Phase

### MVP (12 tasks — all complete)
1. ✅ Project scaffolding + PWA
2. ✅ Auth (Clerk v6)
3. ✅ Database schema (Drizzle ORM, 11 tables)
4. ✅ Onboarding flow (7-step wizard — needs simplification later)
5. ✅ Protocol upload (JSON validation, stored in protocols table)
6. ✅ Calendar view (week/day views, add events)
7. ✅ Training screenshot input (Claude vision, confidence indicators, editable fields)
8. ✅ Fuelling plan generation (3-day rolling, named meal templates, on-bike fuelling, glycogen battery)
9. ✅ Daily dashboard (session fuelling hero, meals, supplements, glycogen, check-in)
10. ✅ Feedback + compliance (ride energy, gut comfort, hunger 1-5, daily yes/mostly/no)
11. ✅ Audio notes (recorder, transcription, AI structured extraction)
12. ✅ Shopping list (3-day aggregated ingredients, 7 categories, tick-off)

### Refinement (Tasks A-F — all complete)
A. ✅ **Nav restructure** — Bottom nav: Today, Calendar, Plan, Progress, More (...). More menu drops up with: Shopping list, Log training, Record note, Settings/Protocol
B. ✅ **Weight tracking** — Weight (kg) and body fat % (optional) added to daily check-in. Current/target weight shown at top of dashboard. Saved to weight_log table (body_fat_pct column added via migration)
C. ✅ **Progress page** — /progress with weight graph (actual vs projected to 72kg target), body fat trend, days on plan, streak, compliance %, average ride energy, "hit target by [date]" projection. Uses Recharts
D. ✅ **Glycogen battery redesign** — Battery icon shape with fill level, labelled "Approx. Glycogen", contextual messages (ready/moderate/low), info popup explaining what glycogen is
E. ✅ **Audio notes fixes** — Fixed double-word transcription (interim vs final results), added plan impact summary under each note
F. ✅ **Plan indicators + polish** — Regeneration banner when plan is stale, loading state with timing message, projected weight on calendar days, More menu distinct background

### Additional polish done
- Loading skeletons on all main pages
- Shopping list strikethrough on ticked items
- Meal colour accents by time of day (breakfast amber, lunch sky blue, dinner violet, snacks lime)
- Cooking notes on each meal (one-line suggestion generated with plan)
- Regenerate button for existing plan days
- Meal timing fixed in prompt (uses actual ride time to schedule meals correctly)
- Shopping list day filter tabs (short date labels)

## Known Issues & Things to Revisit

### Needs fixing/improving
- **Onboarding is too complex** — 7 steps feels like too many. Simplify later
- **Training upload source toggle** — Strava/Rouvy toggle is unnecessary, Claude vision reads any screenshot. Remove toggle
- **Training log ↔ calendar linking** — actual training data should replace planned estimates. "Link to a session" exists but needs to be more prominent and the AI must prioritise real data
- **Plan generation takes 20-30 seconds** — user needs to be patient, loading message helps but it's still slow

### Future features (post-MVP)
- Expanded projections (performance trends, glycogen patterns over time)
- Food photo analysis
- Sleep/stress tracking as structured inputs
- Long-term calendar trajectory view
- Multiple protocol files for season phases
- Expanded feedback dimensions
- Advanced profile learning (pattern detection across weeks/months)
- Energy availability guardrail (internal, not user-facing — RED-S prevention)
- Glycogen battery manual calibration ("I'm empty" / "I'm topped up")

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
/app/plan                     → Fuelling plan viewer with generate/regenerate buttons
/app/progress                 → Progress page (weight graph, projections, streaks)
/app/settings/protocol        → Protocol upload and viewer
/app/shopping                 → Shopping list with tick-off and day filter
/app/sign-in                  → Clerk sign-in page
/app/sign-up                  → Clerk sign-up page
/app/training/upload          → Training screenshot upload flow
/components                   → Reusable UI components
/components/BottomNav.tsx     → Fixed bottom nav (Today/Calendar/Plan/Progress/More)
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
- `calendar_events` — training sessions, races, rest days (with scheduled time)
- `fuelling_plans` — AI-generated daily plans (meals with cooking_notes, on-bike fuelling, supplements, macros, reasoning, glycogen_battery integer)
- `food_log` — actual food eaten when it differs from the plan
- `compliance_log` — daily yes/mostly/no signal
- `feedback_log` — ride_energy / gut_comfort / hunger ratings (1-5)
- `training_log` — screenshot extraction output, confidence score, corrections, linked to calendar events
- `audio_notes` — transcript, AI-processed structured data (summary, tags, energy, gut, symptoms, foods, sentiment, action items, plan_impact)
- `weight_log` — weight_kg, body_fat_pct (nullable), timestamps
- `shopping_lists` — aggregated ingredient lists covering a date range, 7 categories

## Key Conventions

- All components use TypeScript
- Use Tailwind CSS for styling — no separate CSS files
- Mobile-first design — build for phone screens, scale up
- Server components by default, client components only when needed (interactivity, state)
- API routes handle all Claude API calls server-side (never expose API keys to client)
- Use environment variables for all secrets
- When creating PRs, always target the `main` branch
- **Always create a PR when a task is complete**
- Bottom nav: Today / Calendar / Plan / Progress / More (...)
- More menu contains: Shopping list, Log training, Record note, Settings/Protocol
- Anthropic SDK must be instantiated **inside the handler**, not at module level

## Known Gotchas

- **`.npmrc` with `legacy-peer-deps=true`** is required — Clerk v6 peer dependency conflict. Without this, Vercel builds fail
- **Claude Code cloud sandbox cannot connect to Neon** — outbound network blocked. Database migrations/schema changes must be applied manually via the Neon SQL editor. Generate the SQL and tell the user to run it in Neon
- **Drizzle-kit does not auto-load `.env.local`** — pass DATABASE_URL inline for db commands
- **Clerk redirect loop** — happens if CLERK_SIGN_IN_URL / SIGN_UP_URL / AFTER_SIGN_IN_URL / AFTER_SIGN_UP_URL env vars are missing in Vercel
- **Anthropic SDK crashes at module level** — must instantiate `new Anthropic()` inside the route handler, not at top of file
- **Fuelling plan generation timeout** — Vercel hobby plan has 60s limit. Generates 3 days at a time, not 14
- **Default branch is `main`** — Vercel production tracks `main`
- **Meal timing depends on ride time** — the prompt includes actual scheduled_time so the AI plans meals around the ride correctly. Without this, meals get wrong labels (e.g. "pre-ride breakfast" for a 17:00 ride)
- **When actual training data exists** (from screenshots), it should take priority over planned calendar estimates in plan generation

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

- Always read `CUTTA_PRD.md` before starting any task
- This is a single-user personal app — no multi-tenancy needed
- Mobile-first PWA — always test layouts at phone width
- The AI is prescriptive, not reactive — it tells the user what to eat, not tracks what they ate
- Fuelling wraps around training — rides are the anchors, meals support them
- Database migrations cannot be run from Claude Code cloud sandbox — generate SQL and tell user to run in Neon SQL editor
- Always ensure builds pass before committing (`npm run build`)
- Always create a PR at the end of each task
