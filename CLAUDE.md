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
- **AI**: Claude API (vision + text) — not yet integrated
- **PWA**: @ducanh2912/next-pwa — configured in `next.config.mjs`
- **Delivery**: PWA (mobile-first)

## Current State (updated after task 4)

### Completed
1. ✅ **Project scaffolding + PWA** — Next.js 14, App Router, TypeScript, Tailwind, PWA manifest, service worker, placeholder icons
2. ✅ **Auth** — Clerk v6, ClerkProvider, middleware protecting all routes, sign-in/sign-up pages, UserButton
3. ✅ **Database schema** — 11 tables defined via Drizzle ORM in `lib/db/schema.ts`, migration SQL generated at `lib/db/migrations/`
4. ✅ **Onboarding flow** — 7-step wizard collecting baseline data, saves to user_profiles table, routing logic redirects new users to /onboarding

### Next up
5. **Protocol upload + parsing** — Upload JSON file, validate structure, store in database
6. **Calendar view** — Weekly/daily view anchored around training sessions

### Known Issues & Gotchas
- **`.npmrc` with `legacy-peer-deps=true`** is required — Clerk v6 has peer dependency conflict with the installed Next.js version. Without this file, Vercel builds fail.
- **Claude Code cloud sandbox cannot connect to Neon** — outbound network to port 5432 and 443 is blocked. Database migrations must be applied manually via the Neon SQL editor, NOT from Claude Code.
- **Drizzle-kit does not auto-load `.env.local`** — if running db commands, pass DATABASE_URL inline or use dotenv.
- **Clerk environment variables** — the following must all be set in Vercel for auth to work (redirect loop without them):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` → `/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` → `/sign-up`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` → `/`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` → `/`
- **Onboarding may need simplification** — owner feedback is that 7 steps feels too many. Revisit later.
- **Default branch is `main`** — renamed from the original Claude Code branch. Vercel production tracks `main`.

## Project Structure

```
/app                    → Next.js App Router pages and layouts
/app/api                → API routes (AI calls, data endpoints)
/app/onboarding         → Onboarding wizard (multi-step form)
/app/sign-in            → Clerk sign-in page
/app/sign-up            → Clerk sign-up page
/components             → Reusable UI components
/lib                    → Utility functions, database queries, AI helpers
/lib/db                 → Database connection, schema, and migrations
/lib/db/schema.ts       → Drizzle ORM schema (11 tables)
/lib/db/migrations/     → Generated SQL migration files
/public                 → Static assets, PWA icons, manifest
```

## Database Tables (11 total)

All tables use `clerk_user_id varchar(255)` as the user scoping column:

- `user_profiles` — stats, body, training habits, food profile, onboarding flag
- `protocols` — JSON rulebook files; multiple allowed, one `is_active`
- `calendar_events` — training sessions, races, rest days
- `fuelling_plans` — AI-generated daily plans (meals, on-bike fuelling, supplements, macros, reasoning)
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

## AI Integration (not yet built)

- All AI calls go through server-side API routes
- Use the Anthropic TypeScript SDK (`@anthropic-ai/sdk`)
- Vision capability used for Strava/Rouvy screenshot extraction
- The AI reads the user's protocol file (JSON), profile, and training calendar to generate fuelling plans
- Follow the Recommendation Hierarchy defined in the PRD when generating plans

## Build Order (MVP)

Work through these in sequence. Each is a separate task/session:

1. ~~Project scaffolding + PWA setup~~ ✅
2. ~~Auth (Clerk)~~ ✅
3. ~~Database schema (Drizzle ORM)~~ ✅
4. ~~Onboarding flow~~ ✅
5. **Protocol upload + parsing** — Upload JSON file, validate structure, store in database
6. **Calendar view** — Weekly/daily view anchored around training sessions, shell UI
7. **Training screenshot input** — Image upload, send to Claude API vision, extract data, show with confidence indicator and quick-edit, store confirmed data
8. **Fuelling plan generation** — Core AI feature. Send profile + protocol + training calendar to Claude API, generate 2-week rolling plan with meals and on-bike fuelling
9. **Daily dashboard** — Session fuelling (hero), meals as named templates, supplements, calorie summary with reasoning, glycogen battery indicator
10. **Feedback + compliance inputs** — Three feedback signals (ride energy, gut comfort, hunger) + daily yes/mostly/no compliance
11. **Audio notes** — Record audio, transcribe, send to AI for processing into structured data
12. **Shopping list** — Auto-generate 3-day ingredient list from fuelling plan

## Environment Variables (all set in Vercel)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  (set)
CLERK_SECRET_KEY=                   (set)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=      /sign-in (set)
NEXT_PUBLIC_CLERK_SIGN_UP_URL=      /sign-up (set)
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=  / (set)
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=  / (set)
DATABASE_URL=                       (set via Neon integration)
ANTHROPIC_API_KEY=                  (not yet needed)
BLOB_READ_WRITE_TOKEN=              (not yet needed)
```

## Commands

```bash
npm run dev       # Local development
npm run build     # Production build
npm run lint      # Lint check
npm run db:push   # Push schema to Neon (needs DATABASE_URL)
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
