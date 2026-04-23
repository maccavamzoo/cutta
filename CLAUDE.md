# CLAUDE.md

Rules Code can't infer from reading the repo. Everything else (stack, layout, schema, routes) is discoverable — go look.

## Architecture

- `lib/plan-engine.ts` owns all nutrition arithmetic — calories, macros, training burn. Pure, deterministic, no AI, no DB, no side effects.
- Claude only selects foods. It never does arithmetic.
- Advisor is a two-step Claude flow: step1 declares the data it needs, step2 answers using only that data.

## Runtime traps

- Instantiate the Anthropic SDK **inside** route handlers. Module-level instantiation fails on Vercel.
- No date libraries — native `Intl` and `Date` only.
- `PlanView` and `AdvisorView` are imported with `ssr: false`. Do not re-enable SSR.
- Do not remove `staleTimes: { dynamic: 0 }` from `next.config.mjs`.
- Do not re-enable `cacheOnFrontEndNav` or `aggressiveFrontEndNavCaching` in the PWA config.
- For post-save navigation that must refresh other pages, use `window.location.href`, not `router.push`.
- `loading.tsx` skeletons must match the page's outer DOM structure exactly.
- No `beforeunload` on profile edit — it fights the custom unsaved-changes modal.
- AI chat input bar uses `box-shadow` for its top separator, not `border-t`.
- Fixed elements above BottomNav use `bottom-16`.
- Clerk v7: the prop is `afterSignOutUrl`. Curly quotes inside Clerk JSX break builds.

## Database

- Migrations are manual. Write raw SQL in `drizzle/`; Ben runs it in the Neon SQL editor. Claude Code cannot connect to the DB.
- When removing a column: leave it nullable in the Drizzle schema first, drop it in a later cleanup migration.

## Workflow

- No local dev environment. Ben works browser-only: GitHub web editor + Claude Code.
- Default branch: `main`.
- `.npmrc` has `legacy-peer-deps=true` — respect it.

## Philosophy

- Every stored field must be honest. If a value is shown to the user or fed to the AI, it must affect the output. No vestigial fields.
- No legacy fallback handling. Clean breaks only — remove old code as new phases land, in the same PR.
