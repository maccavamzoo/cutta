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
- Deprecated columns that still exist in the DB but are no longer read/written: `fasted_training`, `appetite_profile`, `preferred_meal_timing`, `typical_weekly_hours`, `food_profile`, `gut_sensitivity`, `current_supplements`, `supplements` (on `fuelling_plans`), `tagged_supplement` (on `feedback_log`). The entire `protocols` table is also deprecated — the protocol system was replaced by rest day macros on `user_profiles` and a new `user_activity_types` table.

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
- `weightLossRate` is stored as a stringified number — the kg/week value (e.g. `"0.5"`, `"0.875"`, `"0"`). `"0"` means maintain. Range on the UI slider is 0.2–1.0, but the input box accepts values outside this range with a warning flag.
- `parseRate(rate)` in `lib/weight-projection.ts` handles both the new numeric strings and legacy label values (`aggressive`, `moderate`, `conservative`, `maintain`) for backwards compatibility with old data.
- Progress graph projection line is **fixed** from `targetSetAt` date/weight — it does NOT reset to latest weigh-in. The band uses fixed `AGGRESSIVE_KG_PER_WEEK` (0.875) and `CONSERVATIVE_KG_PER_WEEK` (0.25) bounds regardless of the user's chosen rate. Actual dots plot independently.

## Plan generation

- AI plans are generated one day at a time via Claude Sonnet.
- Requires at least one activity type in `user_activity_types` and rest day macros set on the profile. Fails with a 422 if either is missing.
- Daily calorie target = `maintenanceCalories + trainingBurn − dailyDeficit`.
- `dailyDeficit = (weightLossRate × 7700) / 7` where `7700` is the `KCAL_PER_KG_FAT` constant in the plan engine. 1 kg of fat = 7700 kcal, divided by 7 days.
- Training burn is always added on activity days — there's no `add_training_burn` toggle anymore. For rest days, burn is 0.
- Glycogen battery value comes from the AI plan, not pure math. It only shows when a plan exists for today. When no plan exists, a dimmed empty-state battery is shown.
- **Past fuelling plans are kept as history** — they are no longer deleted on plan page load. The calendar view uses them to show what you ate on past days.
- Calorie deficit is sourced from the **profile**, not the activity or rest day rules. The protocol system's `calorie_offset` field no longer exists.

## Protocol system — REMOVED

- The protocols page, API (`/api/protocol`), and `protocols` table are deprecated. The concept was split into two cleaner pieces:
  - **Rest day macros** now live on `user_profiles` (`rest_day_carbs_g_per_kg`, `rest_day_protein_g_per_kg`).
  - **Activity types** now live in `user_activity_types` — each user builds up their own pool.
- `lib/protocol.ts` now only exports the `ActivityType` interface and a `rowToActivityType` helper. The `ProtocolFile`, `MacroRange`, `RestDayRules`, `RaceWeekRules`, and `validateProtocol` exports are all gone.
- `lib/protocol-templates.ts` was deleted entirely.
- Plan engine takes `restDayMacros` and resolves activity types against the `user_activity_types` table — no protocol JSON is loaded.

## Macros & fat

- All macro g/kg values are stored as **single numbers**, not ranges. The old `MacroRange { min, max }` type is gone. The plan engine used to pick the midpoint or bias toward the high end — now what you see is what's used.
- **Fat is always auto-calculated** — the flex macro. The engine sets protein and carbs from g/kg, then fat fills whatever calories are left. Fat is never stored on activity types or rest day macros. On the UI, fat rows always show "Auto-calculated" with an info button explaining why.

## Activity types

- Stored in `user_activity_types` — one row per activity type per user.
- Calendar events reference activity types by name string (`calendar_events.event_type` matches `user_activity_types.name`).
- `resolveActivityType(activityTypes, eventTypeName)` in `lib/plan-engine.ts` does the matching. Exact name match first, then fallback for legacy event types (`rest`, `race`, `ride`).
- Seeded during onboarding — every new user gets a "Default" moderate-intensity activity type.
- Manual creation form uses intensity presets (Easy/Moderate/Hard/Race) that auto-fill the technical values. Advanced section reveals all fields for tweaking.
- AI-guided creation: the advisor page can accept a `?prefill=...` query param, which auto-clears the chat and sends the prefilled message to kick off a guided conversation.
- AI proposes activity types via `<activity_type>` tags in step2 responses. The advisor UI shows a confirm/reject card; confirming POSTs to `/api/activity-types`.
- Users can't delete their last activity type — at least one must always exist.
- Delete confirmation uses a styled modal, not `window.confirm`.

## Carb loading

- Kicks in automatically when tomorrow is a race, a heavy session (burn rate ≥ 8 kcal/min), or a long session (≥ 90 min). Zero config — driven purely by calendar events.
- `applyCarbLoading()` shifts ~30% of carbs from earlier meals into dinner on the day before. Calories stay the same — carbs redistribute.
- There's no separate race week config. The old `race_week` object on protocols was never actually used by the engine and has been removed.

## Food preferences & profile

- **`food_exclusions`** (text array) is the single source of truth for foods to avoid. This consolidates what was previously split across `food_exclusions`, `foodProfile.negative`, `foodProfile.gutTriggers`, and `gutSensitivity`.
- **`preferred_foods`** (text array) is the single source of truth for foods the user likes.
- **`food_profile`** (JSONB) is fully deprecated — no reads, no writes. Scheduled for column drop.
- **`gut_sensitivity`** (text) is deprecated — low/medium/high was a vague hint that was redundant with specific exclusions. No reads, no writes. Scheduled for column drop.
- Audio notes processing writes food reactions directly to `food_exclusions` and `preferred_foods`.
- Food preferences are edited on a standalone settings page at `/settings/food`, NOT on the profile edit page.

## Profile edit page

- Covers: body stats (current/target weight, height, age, sex), weight loss rate (slider + input + maintain toggle), estimated daily maintenance (Mifflin-St Jeor BMR × 1.2 sedentary), and rest day macros (carbs g/kg, protein g/kg, auto-calculated fat).
- Eating style, training habits (fasted training), gut sensitivity, and supplements have all been removed from this page. Some are now on other pages; most are gone entirely.
- Maintenance calories can be auto-calculated from Mifflin-St Jeor or manually overridden.
- Mifflin-St Jeor formula: male = `10w + 6.25h − 5a + 5`, female = `10w + 6.25h − 5a − 161`, other = `10w + 6.25h − 5a − 78`, then × 1.2 for the sedentary multiplier.

## AI advisor page

- The AI chat page (`/advisor`) is the central input hub. It has:
  - Chat with Cutta AI (activity type creation, shopping strategy, nutrition questions)
  - Mic button for voice-to-text input (uses browser SpeechRecognition API)
  - Log training button (navigates to `/training/upload`)
- The mic uses `continuous: false` on mobile to avoid duplication bugs, `continuous: true` on desktop.
- Voice input transcribes into the text field — user sends it like normal text.
- Chat now renders markdown via `react-markdown` + `remark-gfm`. Bold is white, bullets are lime, headings sized down for mobile.
- Two-step flow: step1 triages what data is needed and returns a holding message. Step2 fetches the data and generates the real answer. Triple-backtick toggle cycles through Normal → Inspect → Live Debug modes.
- Prefill flow: `/advisor?prefill=<urlencoded message>` auto-clears the chat and sends the prefilled message on mount. Used by the activity types page "AI ✦" pill.
- AI-proposed activity types use the same confirm/reject card pattern as shopping strategy updates. Look for `<activity_type>` and `<strategy_update>` tag parsing in the step2 route. The old `<protocol_update>` flow is gone.
- The `/audio` page still exists but is effectively dead — voice input now goes through the AI chat input bar.

## Unsaved changes guards

- Edit profile page has a save/discard/cancel modal that intercepts BottomNav navigation and the back link.
- Food preferences page (`/settings/food`) has the same pattern.
- Advisor page has the same pattern for pending AI-proposed changes (strategy updates, activity types).
- `beforeunload` was **removed** from edit profile — it fought with the custom modal. Don't add it back.
- For post-save navigation that needs fresh data, use `window.location.href` not `router.push`.

## Settings navigation

- BottomNav has 5 items: Today, Plan, AI, Progress, Settings.
- Settings hub: Edit profile, Gut health & food preferences, Activity types, Shopping, plus Account (Clerk UserButton) at the bottom. The old "Fuelling protocol" link is gone.
- All settings sub-pages use a consistent `← Settings` back link at the top on its own line, above the page title.
- Log training and Record note are accessed from the AI page, not from Settings.
- Calendar monthly view is accessed from the Plan page via "Monthly view →" link.
- Any fixed element positioned above BottomNav should use `bottom-16` (64px) — this is the measured height of the nav.

## Known rough edges

- Training log page: source selection (Strava/Rouvy) is being removed. Auto tab (screenshot upload, any app) + Manual tab (form entry) replacing it.
- Next.js server component caching can still occasionally serve stale data despite the fixes. Hard refresh always works.
- The AI chat input bar padding has been fiddly — uses box-shadow instead of border-t for the separator to avoid layout-space issues. Don't reintroduce `border-t` on the input bar outer div.
- "1 hrs before" vs "1 hr before" — activity type display doesn't yet handle singular/plural.

## Planned — not yet built

- Stress test harness for the plan engine. A `lib/plan-engine.test.ts` (or similar) with synthetic scenarios — runs `computeDayBrief()` against a range of inputs and prints readable breakdowns so Ben can verify every variable is used honestly and the numbers line up. Claude Code can run it via `npx tsx`. Build this once the macro/activity/protocol refactor has settled.

## Ben's context

- Accounting and bookkeeping specialist, also runs Bikotic (cycling tools site) and is building Cutta.
- Deep cycling domain knowledge across road, track, and endurance.
- Communicates directly, prefers staged info delivery, dislikes wasted effort, expects honest acknowledgment of uncertainty.
- Strong emphasis on every stored field being honest — if a value is shown to the user or fed to the AI, it must actually affect the output. No vestigial fields pretending to do things.
- Working toward a weight and performance goal for the cycling season.
