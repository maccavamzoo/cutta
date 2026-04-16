# CLUES.md

> Gotchas, traps, and workflow rules that aren't obvious from reading the code.

## Environment & workflow

- No local dev environment. Ben works entirely browser-based: GitHub web editor + Claude Code in the browser.
- `.npmrc` has `legacy-peer-deps=true` — always respect this.
- Anthropic SDK must be instantiated **inside** route handlers, never at module level. Vercel serverless functions will fail otherwise.
- No date libraries. No moment.js, luxon, or date-fns — native `Intl` and `Date` APIs only.
- Default branch is `main`.

## Database & migrations

- Migrations are **manual**. Generate raw SQL files in `drizzle/` — Ben runs them by hand in the Neon SQL editor. Claude Code cannot connect to the DB.
- When adding columns, leave old unused columns in the schema as nullable rather than dropping them immediately. Clean up in a future migration once confirmed safe.
- Deprecated columns still in the DB but no longer read/written: `fasted_training`, `appetite_profile`, `preferred_meal_timing`, `typical_weekly_hours`, `food_profile`, `gut_sensitivity`, `current_supplements`, `supplements` (on `fuelling_plans`), `tagged_supplement` (on `feedback_log`). The entire `protocols` table is also deprecated.

## Deployment traps

- `cacheOnFrontEndNav` and `aggressiveFrontEndNavCaching` are `false` in the PWA config to fix stale page data on navigation. Don't re-enable them.
- `staleTimes: { dynamic: 0 }` in next.config.mjs experimental config prevents client-side router cache serving stale server component data. Don't remove it.
- When profile saves need other pages to refresh, use `window.location.href` for post-save navigation instead of `router.push` — this bypasses the client cache.

## Auth

- Clerk v6 gotcha: `afterSignOutUrl` is the correct prop name. Older prop names cause build failures. Always verify Clerk component APIs against the installed version.
- JSX curly-quote escaping in Clerk components can cause build failures.

## Hydration

- PlanView and AdvisorView use `dynamic(() => import("./Component"), { ssr: false })` to avoid hydration bugs. Don't re-enable SSR for these.
- `loading.tsx` Suspense skeletons must match the actual page's outer DOM structure exactly (same `<main>` wrapper, same container divs). Mismatched structure causes Next.js to orphan DOM nodes or re-mount client components.

## UI traps

- `beforeunload` was removed from profile edit — it fought with the custom unsaved-changes modal. Don't add it back.
- The AI chat input bar uses `box-shadow` instead of `border-t` for the separator. `border-t` causes layout-space issues — don't reintroduce it.
- Any fixed element positioned above BottomNav should use `bottom-16` (64px).

## Ben's context

- Accounting and bookkeeping specialist, also runs Bikotic (cycling tools site) and is building Cutta.
- Deep cycling domain knowledge across road, track, and endurance.
- Communicates directly, prefers staged info delivery, dislikes wasted effort, expects honest acknowledgment of uncertainty.
- Strong emphasis on every stored field being honest — if a value is shown to the user or fed to the AI, it must actually affect the output. No vestigial fields.
