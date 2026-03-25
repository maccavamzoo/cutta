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
- **File Storage**: Vercel Blob or Cloudflare R2 (images, audio) — not yet set up
- **Auth**: Clerk (v6, Google + email sign-in)
- **AI**: Claude API via Anthropic TypeScript SDK (`@anthropic-ai/sdk`), model: `claude-sonnet-4-20250514`
- **PWA**: @ducanh2912/next-pwa — configured in `next.config.mjs`
- **Delivery**: PWA (mobile-first)

## Current State (updated after task 8)

### Completed
1. ✅ **Project scaffolding + PWA** — Next.js 14, App Router, TypeScript, Tailwind, PWA manifest, service worker, placeholder icons
2. ✅ **Auth** — Clerk v6, ClerkProvider, middleware protecting all routes, sign-in/sign-up pages, UserButton
3. ✅ **Database schema** — 11 tables defined via Drizzle ORM in `lib/db/schema.ts`, migrations applied via Neon SQL editor
4. ✅ **Onboarding flow** — 7-step wizard collecting baseline data, saves to user_profiles table, routing logic redirects new users to /onboarding (owner notes: may need simplification later — too many steps)
5. ✅ **Protocol upload** — JSON protocol file upload, validation, stored in protocols table. Active protocol shown at /settings/protocol. New uploads deactivate previous protocol. Validation lib at `lib/protocol.ts`
6. ✅ **Calendar view** — Week view (default) with day view. Add training sessions via bottom sheet (type, duration, intensity, notes). Nav arrows, event-coloured dots, FAB for adding events. Client-fetches when navigating weeks
7. ✅ **Training screenshot input** — Upload Strava/Rouvy screenshots at /training/upload. 4-stage flow: pick source → AI extracts via Claude vision → review with confidence indicators and editable fields → confirm and save to training_log. Corrections stored as diff
8. ✅ **Fuelling plan generation** — Core AI feature at /plan. Sends profile + protocol + calendar + recent training to Claude API. Generates 14-day rolling plan with named meal templates, on-bike fuelling, supplements, calorie reasoning, glycogen battery (0-100). Prompt builder at `lib/ai/buildPlanPrompt.ts`. Plans upserted per day to fuelling_plans table. Glycogen battery displayed as coloured progress bar (lime/amber/red)

### Next up
9. **Daily dashboard** — Session fuelling (hero), meals as named templates, supplements, calorie summary with reasoning, glycogen battery indicator
10. **Feedback + compliance inputs** — Three feedback signals (ride energy, gut comfort, hunger) + daily yes/mostly/no compliance
11. **Audio notes** — Record audio, transcribe, send to AI for processing into structured data
12. **Shopping list** — Auto-generate 3-day ingredient list from fuelling plan

## Project Structure

```
/app                          → Next.js App Router pages and layouts
/app/api                      → API routes
/app/api/calendar/route.ts    → GET/POST calendar events
/app/api/protocol/route.ts    → GET/POST protocols
/app/api/training-log/extract/route.ts → POST screenshot to Claude vision
/app/api/training-log/route.ts → POST confirmed training data
/app/api/fuelling-plan/generate/route.ts → POST generate 14-day plan via Claude
/app/calendar                 → Calendar week/day views, add event sheet
/app/onboarding               → 7-step onboarding wizard
/app/plan                     → Fuelling plan viewer with generate button
/app/settings/protocol        → Protocol upload and viewer
/app/sign-in                  → Clerk sign-in page
/app/sign-up                  → Clerk sign-up page
/app/training/upload          → Training screenshot upload flow
/components                   → Reusable UI components
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
- `feedback_log` — ride_energy / gut_comfort / hunger ratings
- `training_log` — screenshot extraction output, confidence score, corrections
- `audio_notes` — audio URL, transcript, AI-processed structured data
- `weight_log` — weigh-in entries with timestamps
- `shopping_lists` — aggregated ingredient lists covering a date range

## Key Conventions

- All components use TypeScript
- Use Tailwind CSS for styling — no separate CSS files
- Mobile-first design — build for phone screens, scale up
- Server components by default, client components only when needed (interactivity, state)
- API routes handle all Claude API calls server-side (never expose API keys to client)
- Use environment variables for all secrets
- When creating PRs, always target the `main` branch
- **Always create a PR when a task is complete** — don't just push to branch without creating a PR

## Known Issues & Gotchas

- **`.npmrc` with `legacy-peer-deps=true`** is required — Clerk v6 has peer dependency conflict with the installed Next.js version. Without this file, Vercel builds fail.
- **Claude Code cloud sandbox cannot connect to Neon** — outbound network to port 5432 and 443 is blocked. Database migrations/schema changes must be applied manually via the Neon SQL editor, NOT from Claude Code. When a schema change is needed, generate the SQL and tell the user to run it in Neon.
- **Drizzle-kit does not auto-load `.env.local`** — if running db commands, pass DATABASE_URL inline or use dotenv.
- **Clerk environment variables** — the following must all be set in Vercel for auth to work (redirect loop without them):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` → `/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` → `/sign-up`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` → `/`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` → `/`
- **Default branch is `main`** — Vercel production tracks `main`.
- **Onboarding may need simplification** — owner feedback is that 7 steps feels too many. Revisit later.
- **Training upload source toggle** — the Strava/Rouvy toggle is probably unnecessary, Claude vision can read any screenshot. Simplify later.

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
BLOB_READ_WRITE_TOKEN=              (not yet needed)
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
