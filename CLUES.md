# CLUES.md

> Things the code can't tell you — rules, quirks, and context that live outside the codebase.

## Environment & tooling

- No local dev environment. Ben works entirely browser-based: GitHub web editor + Claude Code in the browser.
- Workflow: discuss design decisions in Claude chat first, then receive detailed prompts to paste into Claude Code for implementation.
- `.npmrc` has `legacy-peer-deps=true` — always respect this.
- Anthropic SDK must be instantiated **inside** route handlers, never at module level. Vercel serverless functions will fail otherwise.
- No date libraries. No moment.js, luxon, or date-fns — native `Intl` and `Date` APIs only.
- Default branch is `main`.

## Database & migrations

- Neon Postgres via Drizzle ORM.
- Migrations are **manual**. Generate raw SQL files in `drizzle/` — Ben runs them by hand in the Neon SQL editor. Claude Code cannot connect to the DB.
- When adding columns, leave old unused columns in the schema as nullable rather than dropping them immediately. Clean up in a future migration once confirmed safe.

## Deployment

- Deployed on Vercel. PWA enabled via `@ducanh2912/next-pwa`.
- `cacheOnFrontEndNav` and `aggressiveFrontEndNavCaching` were set to `false` to fix stale page data on navigation. Don't re-enable them.
- `next.config.mjs` has `staleTimes: { dynamic: 0 }` in experimental config to prevent client-side router cache serving stale server component data.
- When profile saves need other pages to refresh (progress, plan, dashboard), use `window.location.href` for post-save navigation instead of `router.push` to bypass client cache.

## Auth

- Clerk v6. Single user app right now (Ben), but built to support multiple users via `clerkUserId` on every table.
- Clerk v6 gotcha: `afterSignOutUrl` is the correct prop name. Older prop names cause build failures. Always verify Clerk component APIs against the installed version before using them.
- JSX curly-quote escaping in Clerk components can cause build failures — watch for this.
- `UserButton` from Clerk is on the Settings page (Account section at the bottom).

## Hydration & loading.tsx — IMPORTANT

- Multiple pages use `dynamic(() => import("./Component"), { ssr: false })` to avoid hydration bugs: **PlanView** and **AdvisorView**. This is intentional — don't re-enable SSR for these components.
- `loading.tsx` Suspense skeletons must match the actual page's outer DOM structure exactly (same `<main>` wrapper, same container divs). Mismatched structure causes Next.js streaming to orphan DOM nodes outside the React tree or re-mount client components (wiping state).
- When this is hard to achieve, use `dynamic(() => import("./Component"), { ssr: false })` to skip server-rendering the complex client component entirely. The loading skeleton covers the gap.

## Timezone handling

- `user_profiles` has a `timezone` column (varchar). Used server-side to calculate "today" for each user.
- Falls back to `"Europe/London"` when null.
- `getUserToday(timezone)` utility in `lib/dates.ts` returns `{ todayStr, todayStart, todayEnd }`.
- `getMonthBounds(timezone, monthStr)` and `getDayBounds(timezone, dateStr)` also in `lib/dates.ts` for calendar queries.
- The Today page shows the time before the greeting to confirm the timezone is correct.

## Weight & targets

- Weigh-in card on the Today page is **blank** if not logged today — no carrying forward yesterday's number. But `currentWeightKg` on the profile persists for downstream calculations.
- `targetSetAt` timestamp in `user_profiles` records when the user last changed their **target weight** (not the loss rate). This anchors the progress graph projection.
- `weightLossRate` choices: aggressive (~0.75–1 kg/week), moderate (~0.4–0.6), conservative (~0.2–0.3), maintain (0). Stored as a string enum.
- Progress graph projection line is **fixed** from `targetSetAt` date/weight — it does NOT reset to latest weigh-in. Actual dots plot independently against this fixed reference.

## Plan generation

- AI plans are generated one day at a time via Claude Sonnet.
- Requires an active protocol (JSON) — generation fails silently if none exists.
- Daily calorie target = Mifflin-St Jeor BMR × 1.2 (sedentary) + training burn − deficit from `weightLossRate`.
- `typicalWeeklyHours` was removed — activity burn comes from calendar events, not a static guess.
- Glycogen battery value comes from the AI plan, not pure math. It only shows when a plan exists for today. When no plan exists, a dimmed empty-state battery is shown.
- **Past fuelling plans are kept as history** — they are no longer deleted on plan page load. The calendar view uses them to show what you ate on past days.

## Protocol system

- Protocols are JSON objects stored in the `protocols` table.
- 4 built-in templates in `lib/protocol-templates.ts` (Endurance Base, Race Week, Weight Loss, General Health).
- Users can save custom templates (`is_template` boolean on the protocols table).
- Protocol page has a template picker and a readable view of the active protocol.
- The AI advisor chat can propose protocol edits via `<protocol_update>` tags — user must confirm before saving.
- When saving a modified protocol, user names it and it's saved as both active + template.
- Deleting all custom templates auto-activates "General Health".

## Food preferences & profile

- **`food_exclusions`** (text array) is the single source of truth for foods to avoid. This column now contains what was previously split across `food_exclusions`, `foodProfile.negative`, and `foodProfile.gutTriggers`.
- **`preferred_foods`** (text array) is the single source of truth for foods the user likes. Previously hidden inside `foodProfile.positive`.
- **`food_profile`** (JSONB) is deprecated for the above fields. It may still contain `supplementReactions` data. Don't write `gutTriggers`, `negative`, or `positive` to it — use the flat columns instead.
- Audio notes processing writes food reactions directly to `food_exclusions` and `preferred_foods` columns, not to `food_profile`.
- Food preferences are edited on a standalone settings page at `/settings/food`, NOT on the profile edit page.
- The profile edit page (`/settings/profile`) covers: body stats, weight target, daily energy, training habits, eating style.

## AI advisor page

- The AI chat page (`/advisor`) is the central input hub. It has:
  - Chat with Cutta AI (protocol tweaks, shopping strategy, nutrition questions)
  - Mic button for voice-to-text input (uses browser SpeechRecognition API)
  - Log training button (navigates to `/training/upload`)
- The mic uses `continuous: false` on mobile to avoid duplication bugs, `continuous: true` on desktop.
- Voice input transcribes into the text field — user sends it like normal text. There is no separate audio note processing flow from this page.
- The `/audio` page still exists but is effectively dead — voice input now goes through the AI chat input bar.

## Audio notes (legacy)

- The `/audio` page and `/api/audio-notes` endpoint still exist but are no longer linked from the UI.
- Audio notes processing still writes to `food_exclusions` and `preferred_foods` if called directly.
- The AI advisor chat is the intended replacement for audio notes going forward.

## Eating style

- `appetiteProfile` stores comma-joined multi-select pills (e.g. "3 big meals, no snacking, Done eating by 7pm").
- `preferredMealTiming` is deprecated — still in schema but no longer read or written. Will be dropped in a future migration.

## Unsaved changes guards

- Edit profile page has a save/discard/cancel modal that intercepts BottomNav navigation and the back link.
- Food preferences page (`/settings/food`) has the same pattern.
- Protocol page has the same pattern for pending AI-proposed changes.
- `beforeunload` was **removed** from edit profile — it fought with the custom modal. Don't add it back.
- For post-save navigation that needs fresh data, use `window.location.href` not `router.push`.

## Navigation

- BottomNav has 5 items: Today, Plan, AI, Progress, Settings.
- Settings → hub for Edit profile, Gut health & food preferences, Protocol, Shopping, plus Account (Clerk UserButton) at the bottom.
- Log training and Record note are accessed from the AI page, not from Settings.
- Calendar monthly view is accessed from the Plan page via "Monthly view →" link.
- Any fixed element positioned above BottomNav should use `bottom-16` (64px) — this is the measured height of the nav.

## Known rough edges

- Training log page: source selection (Strava/Rouvy) is being removed. Auto tab (screenshot upload, any app) + Manual tab (form entry) replacing it.
- Plan generation button UX: clicking any of the 3 day buttons generates all 3 days. The separate per-day buttons are somewhat misleading.
- Next.js server component caching can still occasionally serve stale data despite the fixes. Hard refresh always works.
- The AI chat input bar padding has been fiddly — uses box-shadow instead of border-t for the separator to avoid layout-space issues. Don't reintroduce `border-t` on the input bar outer div.

## Ben's context

- Accounting and bookkeeping specialist, also runs Bikotic (cycling tools site) and is building Cutta.
- Deep cycling domain knowledge across road, track, and endurance.
- Communicates directly, prefers staged info delivery, dislikes wasted effort, expects honest acknowledgment of uncertainty.
- Working toward a weight and performance goal for the cycling season.
