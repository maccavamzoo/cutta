# CLAUDE.md — Cutta

## What is this project?

Cutta is an AI-powered performance fuelling system for endurance cyclists. It tells the user what to eat, when, and how much — based on their training schedule, body profile, and a user-defined protocol file. See `CUTTA_PRD.md` in the repo root for the full product spec.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Database**: Vercel Postgres (Neon)
- **File Storage**: Vercel Blob or Cloudflare R2 (images, audio)
- **Auth**: Clerk
- **AI**: Claude API (vision + text)
- **Delivery**: PWA (mobile-first)

## Project Structure

```
/app              → Next.js App Router pages and layouts
/app/api          → API routes (AI calls, data endpoints)
/components       → Reusable UI components
/lib              → Utility functions, database queries, AI helpers
/lib/db           → Database connection and query functions
/public           → Static assets
```

## Key Conventions

- All components use TypeScript
- Use Tailwind CSS for styling — no separate CSS files
- Mobile-first design — build for phone screens, scale up
- Server components by default, client components only when needed (interactivity, state)
- API routes handle all Claude API calls server-side (never expose API keys to client)
- Use environment variables for all secrets (CLERK_*, ANTHROPIC_API_KEY, DATABASE_URL)

## Database

- Vercel Postgres (Neon) — connection via `@vercel/postgres` or Neon serverless driver
- Migrations managed manually or via Drizzle ORM (TBD)
- See Data Model section in `CUTTA_PRD.md` for table structure

## AI Integration

- All AI calls go through server-side API routes
- Use the Anthropic TypeScript SDK (`@anthropic-ai/sdk`)
- Vision capability used for Strava/Rouvy screenshot extraction
- The AI reads the user's protocol file (JSON), profile, and training calendar to generate fuelling plans
- Follow the Recommendation Hierarchy defined in the PRD when generating plans

## Build Order (MVP)

Work through these in sequence. Each is a separate task/session:

1. **Project scaffolding + PWA setup** — Next.js 14, App Router, TypeScript, Tailwind, PWA manifest and service worker
2. **Auth** — Clerk integration, login/signup, protected routes
3. **Database schema** — Tables for user profile, protocol, calendar events, fuelling plans, feedback, compliance, training log, audio notes, weight log, shopping lists
4. **Onboarding flow** — Multi-step form collecting baseline data (see Onboarding section in PRD)
5. **Protocol upload + parsing** — Upload JSON file, validate structure, store in database
6. **Calendar view** — Weekly/daily view anchored around training sessions, shell UI
7. **Training screenshot input** — Image upload, send to Claude API vision, extract data, show with confidence indicator and quick-edit, store confirmed data
8. **Fuelling plan generation** — Core AI feature. Send profile + protocol + training calendar to Claude API, generate 2-week rolling plan with meals and on-bike fuelling
9. **Daily dashboard** — Session fuelling (hero), meals as named templates, supplements, calorie summary with reasoning, glycogen battery indicator
10. **Feedback + compliance inputs** — Three feedback signals (ride energy, gut comfort, hunger) + daily yes/mostly/no compliance
11. **Audio notes** — Record audio, transcribe, send to AI for processing into structured data
12. **Shopping list** — Auto-generate 3-day ingredient list from fuelling plan

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=  (if using Vercel Blob)
```

## Commands

```bash
npm run dev       # Local development
npm run build     # Production build
npm run lint      # Lint check
```

## Important Notes

- Always read `CUTTA_PRD.md` before starting any task — it contains the full product spec, recommendation hierarchy, AI behaviour rules, and success/failure criteria
- This is a single-user personal app — no multi-tenancy needed
- Mobile-first PWA — always test layouts at phone width
- The AI is prescriptive, not reactive — it tells the user what to eat, it doesn't just track what they ate
- Fuelling wraps around training — rides are the anchors, meals support them
