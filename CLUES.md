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

## Timezone handling

- `user_profiles` has a `timezone` column (varchar). Used server-side to calculate "today" for each user.
- Falls back to `"Europe/London"` when null.
- A `getUserToday(timezone)` utility in `lib/dates.ts` returns `{ todayStr, todayStart, todayEnd }`.
- The Today page shows the time before the greeting to confirm the timezone is correct.

## Weight & targets

- Weigh-in card on the Today page is **blank** if not logged today — no carrying forward yesterday's number. But `currentWeightKg` on the profile persists for downstream calculations.
- `targetSetAt` timestamp in `user_profiles` records when the user last changed their **target weight** (not the loss rate). This anchors the progress graph projection.
- `weightLossRate` choices: aggressive (~0.75–1 kg/week), moderate (~0.4–0.6), conservative (~0.2–0.3), maintain (0). Stored as a string enum.
- Progress graph projection line is **fixed** from `targetSetAt` date/weight — it does NOT reset to latest weigh-in. Actual dots plot independently against this fixed reference.

## Plan generation

- AI plans are generated 3 days at a time via Claude Sonnet.
- Requires an active protocol (JSON) — generation fails silently if none exists.
- Daily calorie target = Mifflin-St Jeor BMR × 1.2 (sedentary) + training burn − deficit from `weightLossRate`.
- `typicalWeeklyHours` was removed — activity burn comes from calendar events, not a static guess.
- Glycogen battery value comes from the AI plan, not pure math. It only shows when a plan exists for today. When no plan exists, a dimmed empty-state battery is shown.

## Protocol system

- Protocols are JSON objects stored in the `protocols` table.
- 4 built-in templates in `lib/protocol-templates.ts` (Endurance Base, Race Week, Weight Loss, General Health).
- Users can save custom templates (`is_template` boolean on the protocols table).
- Protocol page has two tabs: "Protocol" (templates + readable view) and "✨ Tweak with AI" (chat).
- The AI chat can propose protocol edits via `<protocol_update>` tags — user must confirm before saving.
- When saving a modified protocol, user names it and it's saved as both active + template.
- Deleting all custom templates auto-activates "General Health".

## Audio notes

- Uses browser SpeechRecognition API (Chrome/Safari only).
- Transcripts are processed by Claude Sonnet to extract structured data.
- Food reactions automatically update `food_profile` on `user_profiles` (positive, negative, gutTriggers).
- `food_profile` feeds into plan generation prompt — this is how voice notes influence future plans.

## Eating style

- `appetiteProfile` stores comma-joined multi-select pills (e.g. "3 big meals, no snacking, Done eating by 7pm").
- `preferredMealTiming` is deprecated — still in schema but no longer read or written. Will be dropped in a future migration.

## Unsaved changes guards

- Edit profile page has a save/discard/cancel modal that intercepts BottomNav navigation and the back link.
- Protocol page has the same pattern for pending AI-proposed changes.
- `beforeunload` was **removed** from edit profile — it fought with the custom modal. Don't add it back.
- For post-save navigation that needs fresh data, use `window.location.href` not `router.push`.

## Navigation

- BottomNav has 5 items: Today, Plan, Progress, Settings, More.
- Settings → hub for Edit profile, Protocol.
- More → Shopping list, Log training, Record note.
- BottomNav accepts an `onNavigate` prop for pages that need to intercept navigation (dirty check).

## Known rough edges

- Training log page: source selection (Strava/Rouvy) is being removed. Auto tab (screenshot upload, any app) + Manual tab (form entry) replacing it.
- Plan generation button UX: clicking any of the 3 day buttons generates all 3 days. The separate per-day buttons are somewhat misleading.
- Next.js server component caching can still occasionally serve stale data despite the fixes. Hard refresh always works.

## Ben's context

- Accounting and bookkeeping specialist, also runs Bikotic (cycling tools site) and is building Cutta.
- Deep cycling domain knowledge across road, track, and endurance.
- Communicates directly, prefers staged info delivery, dislikes wasted effort, expects honest acknowledgment of uncertainty.
- Working toward a weight and performance goal for the cycling season.
