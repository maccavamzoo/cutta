# Cutta — Product Requirements Document

## Vision

Cutta is an AI-powered **performance fuelling system** for endurance cyclists. Its core purpose is to **remove the responsibility of food decisions from the user** — telling them exactly what to eat, when, and how much, based on their training schedule, body profile, and goals.

It is **prescriptive, not a tracker**. The AI builds a rolling fuelling plan oriented around training sessions and events, adapts it based on performance data and user feedback, and learns what works (and what doesn't) for the individual over time.

Cutta is not a diet app. It is a **training-aware fuelling system that happens to include meals**. The language, the UI, and the logic all orient around fuelling, readiness, recovery, and body composition — not calorie counting or dieting.

---

## User Profile

- Single-user app (personal tool)
- Target user: endurance cyclist managing weight while maintaining performance
- Initial goal: 78kg → 72kg for the current season
- Ongoing goal: stay at target weight, stay fuelled, stay healthy long-term

---

## Core Design Principles

1. **Tell me what to eat** — the app makes the decisions, the user follows the plan
2. **Training comes first** — meals and fuelling serve the training schedule, not the other way round
3. **Adapt and learn** — the AI builds a profile over time, learning what works and what doesn't
4. **Flexible framework** — the app is a platform, not a fixed feature set. New inputs and tracking dimensions can be added at any time
5. **Instant updates** — every input triggers a recalculation, no waiting
6. **Mobile-first** — designed for use on the go (PWA)
7. **Simple output** — meals presented as named templates with plain ingredients and weights (e.g. "Chicken rice bowl — 100g chicken breast, 100g white rice, courgette")
8. **Show the why** — every recommendation comes with a short explanation so the user builds trust and understanding over time

---

## Recommendation Hierarchy

When the AI generates or adjusts a plan, conflicting rules are resolved in this order:

1. **Health and performance guardrails** — energy availability, rate of weight loss, RED-S prevention
2. **Training demands** — session fuelling, recovery needs, glycogen replenishment
3. **Protocol rules** — the user's active protocol file
4. **Food tolerances** — known gut triggers, negative food profile
5. **Preferences** — positive food profile, taste preferences
6. **Convenience** — ease of shopping, cooking, prep time

---

## Onboarding

Before the AI can generate a useful plan, it needs a baseline. The onboarding flow collects:

- **Body stats** — current weight, target weight, height, age, sex
- **Training baseline** — typical weekly hours, session types (road, indoor, track), usual intensity
- **Training habits** — fasted training yes/no, morning/evening preference, indoor/outdoor
- **Estimated maintenance calories** — AI calculates from stats and training load, user can override
- **Usual carb intake** — rough sense of current diet to avoid dramatic shifts on day one
- **Gut sensitivity** — known problem foods, history of bloating/IBS, supplement reactions
- **Appetite profile** — big breakfast or small, snacker or three meals, late eater etc.
- **Preferred meal timing** — when the user typically eats relative to training
- **Food exclusions** — anything that's out from day one (e.g. eggs, dairy)
- **Current supplements** — what they're already taking

This baseline calibrates the initial plan. It doesn't need to be perfect — the AI refines it over time.

---

## Inputs

### Training Data (via screenshots)
- User uploads screenshots from **Strava** and/or **Rouvy**
- AI uses vision to extract: duration, distance, power, heart rate, elevation, estimated calories
- AI shows extracted data with a **confidence indicator** and quick-edit UI (e.g. "85% confident: 180W avg — tap to edit")
- Corrections are stored to improve future extraction accuracy

### Audio Notes
- User records voice memos at any time
- App transcribes audio and the AI processes it into structured profile/log data
- Used for: symptoms ("felt bloated after lunch"), energy levels on rides, gut comfort, anything ad hoc

### Manual Input
- Upcoming training sessions and events added to the calendar
- Training schedule can change fluidly — the app recalculates when it does

### Protocol File (JSON)
- User-defined fuelling rules that the AI follows as its rulebook
- Covers: rest day macros, training day macros, pre-ride fuelling, on-bike fuelling, post-ride recovery, race week strategy
- Can be edited outside the app and re-uploaded at any time
- Can have different protocol files for different phases of the season
- Example structure:

```json
{
  "protocol_name": "Early Season Cut",
  "target_weight_kg": 72,
  "max_weekly_loss_kg": 0.5,
  "rest_day": {
    "calories": "deficit",
    "carbs": "low",
    "protein": "high",
    "fat": "moderate"
  },
  "training_day": {
    "calories": "maintenance",
    "carbs": "moderate-high",
    "protein": "high",
    "fat": "low-moderate"
  },
  "pre_ride": {
    "timing_hours_before": 3,
    "focus": "carbs, easily digestible"
  },
  "on_bike": {
    "under_90min": "water and electrolytes only",
    "over_90min": "60-90g carbs per hour via gels, drink mix, or bars",
    "over_3hrs": "90g carbs per hour plus solid food options"
  },
  "post_ride": {
    "timing_minutes_after": 30,
    "focus": "protein + carbs for recovery"
  },
  "race_week": {
    "strategy": "taper calories then carb load"
  }
}
```

### Explicit Preferences
- Positive/negative food profile: user tells the app what's in and what's out (e.g. "eggs are out")
- Updated at any time — triggers recalculation of the full plan
- AI also builds this profile passively from feedback patterns over time

### Feedback (V1 — focused)
V1 feedback is kept tight to three actionable signals:
- **Energy on rides** — how fuelled did you feel during training?
- **Gut comfort** — any bloating, discomfort, or digestive issues?
- **Hunger** — are you coping with the plan, or constantly starving?

These are the most useful early signals. Additional dimensions (mood, sleep, stress) can be introduced later via audio notes or future feedback expansion.

### Daily Compliance Signal
A simple daily check-in:
- **Yes** — followed the plan
- **Mostly** — close but deviated
- **No** — didn't follow it

This helps the AI distinguish between a bad plan, bad execution, and unexpected life disruption. Critical for learning what's actually working.

---

## Outputs

### Calendar (Primary UI)
- Central view of the app
- **Oriented around training sessions** — rides and events are the anchors, fuelling wraps around them
- Shows:
  - **Fuelling plans** for each day (rolling 2-week detailed plan)
  - **On-bike fuelling** for each session (gels, drink mix, bars, carbs per hour)
  - **Upcoming training and events**
  - **Longer-term trajectory** beyond 2 weeks — target milestones, key events, projected weight
- Auto-repopulates when inputs change (training shifts, food preferences updated, protocol changed)

### Daily Dashboard
- **Session fuelling** (hero section) — pre-ride, on-bike, and post-ride fuelling for today's training, with timing
- **Meals** — named templates with ingredients and weights (e.g. "Recovery bowl — 150g salmon, 120g sweet potato, spinach, olive oil")
- **Supplements** — what to take and when (Omega-3, Vitamin D, Creatine, etc.), tracked for reactions
- **Glycogen battery** — visual indicator of estimated glycogen level based on recent food intake, training load, and timing. Reframes eating as fuelling — shows when you need carbs and when you're topped up
- **Daily summary** — total calories and a short explanation of why (e.g. "Big ride tomorrow — glycogen low, carb-loading tonight to top up the battery")
- **Weight projection graph** — 2-week projection towards target weight

### Shopping List
- Auto-generated from the fuelling plan
- Covers 3 days ahead
- Aggregated by ingredient

### Supplement Tracking
- Schedule of what to take and when
- Tracked for reactions the same way food is — gut comfort signal captures this
- AI adjusts dosing, timing, or removes supplements based on reported symptoms

---

## AI Behaviour

### Profile Building
- The AI maintains a living profile of the user that builds over time
- Includes: food tolerances, gut triggers, preferred foods, energy patterns, training capacity, supplement reactions
- Profile is built from **two directions**:
  1. Explicit input (user says "eggs don't work for me")
  2. Learned patterns (AI notices bloating correlates with high-gluten meals)

### Plan Generation
- AI reads the **protocol file** for the rules
- Cross-references the **user profile** for tolerances and preferences
- Looks at the **training calendar** for upcoming load
- Generates a rolling **2-week fuelling plan** with specific meals, on-bike fuelling, portions, and timing
- Recalculates instantly when any input changes
- **Fuelling wraps around training** — the plan starts with session demands, then builds meals to support them

### Macro Management
- Macros flex based on the day:
  - Rest days: low carb, high protein, calorie deficit
  - Training days: higher carbs, maintenance or slight surplus depending on session intensity
  - Pre-big ride: carb loading the evening before
  - Race week: follows protocol-defined race week strategy
- All governed by the protocol file — user can see and tweak the rules

### Performance Guardrails
- **Rate of weight loss** is capped to protect performance (e.g. max 0.5kg/week)
- If the user reports declining performance, fatigue, or excessive hunger, the AI should ease the deficit
- The goal is sustainable body composition management, not a crash diet

### Energy Availability (Internal Guardrail)
- The AI tracks estimated **energy availability**: intake minus exercise expenditure, normalised against estimated fat-free mass
- This is **not user-facing** — it runs as an internal safety check
- If energy availability drops too low, the AI overrides the deficit and increases intake to prevent:
  - Chronic under-fuelling
  - Poor recovery and adaptation
  - Low mood and suppressed immune function
  - RED-S (Relative Energy Deficiency in Sport)
- This guardrail sits at the **top of the recommendation hierarchy** — it overrides protocol rules and weight loss targets

### Glycogen Estimation
- AI maintains a running estimate of the user's glycogen level based on: carb intake, training load, session duration/intensity, and time since last meal/session
- Displayed as a visual "battery" on the daily dashboard
- Used to inform fuelling decisions — e.g. prioritise carbs when glycogen is estimated low, dial back when topped up
- Helps the user understand *why* the plan says what it says

### Showing the Why
- Every daily plan includes a short explanation of the AI's reasoning
- Examples:
  - "Low glycogen today — carbs are higher to replenish before tomorrow's session"
  - "Hard session tomorrow — dinner shifts carb-heavy to top up the battery"
  - "Poor recovery signals this week — deficit eased to support adaptation"
  - "Rest day, no training planned — low carb, high protein, moderate deficit"
- Builds trust and teaches the user over time without being educational-first

### Adaptability
- The AI treats every interaction as an opportunity to learn
- Sleep, stress, fatigue, illness — all factor into plan adjustments
- New tracking dimensions can be introduced at any time without app changes (user just starts mentioning them in audio notes or feedback)

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Deployment | Vercel |
| Database | Vercel Postgres |
| File Storage | Vercel Blob or Cloudflare R2 (images, audio) |
| Auth | Clerk |
| AI | Claude API (vision + text) |
| Delivery | PWA (mobile-first) |

---

## Data Model (High Level)

- **User Profile** — personal stats, goals, food tolerances, supplement reactions, gut triggers, preferences, appetite profile, training habits
- **Protocol** — active JSON protocol file
- **Calendar Events** — training sessions, races, events
- **Fuelling Plans** — generated plans linked to dates (meals + on-bike fuelling)
- **Food Log** — what was actually eaten (if different from plan)
- **Compliance Log** — daily yes/mostly/no signal
- **Feedback Log** — energy on rides, gut comfort, hunger, tagged to meals/supplements/dates
- **Training Log** — extracted data from Strava/Rouvy screenshots, with correction history
- **Audio Notes** — transcribed and processed notes with timestamps
- **Weight Log** — daily/regular weigh-ins
- **Shopping Lists** — generated lists linked to date ranges

---

## Success Metrics

- **Plan adherence** — percentage of days marked yes/mostly
- **Body composition trajectory** — weight change over time vs target
- **Ride energy** — user-reported energy on rides trending stable or improving
- **Gut comfort** — reduction in bloating/discomfort reports over time
- **Extraction accuracy** — reduction in user corrections to screenshot data over time
- **Decision time** — user spends less time thinking about food
- **Weekly active use** — consistent engagement with the app

## Failure States

- Repeated under-fuelling (energy availability drops, performance declines)
- Poor user trust due to frequent extraction errors or bad recommendations
- Excessive recalculations causing plan instability (the plan changes too often to follow)
- Recommendations that are impractical to shop for or cook
- User stops logging compliance/feedback — the learning loop breaks
- Plan feels generic rather than personal

---

## MVP Scope

For the first working version, focus on:

1. **Auth** — login via Clerk
2. **Onboarding flow** — baseline calibration (stats, training habits, gut sensitivity, food exclusions, current supplements)
3. **Protocol upload** — upload and parse a JSON protocol file
4. **Calendar view** — weekly/daily view anchored around training sessions
5. **Fuelling plan generation** — AI generates a 2-week rolling plan including on-bike fuelling, based on profile + protocol + training calendar
6. **Training input** — upload Strava/Rouvy screenshots, AI extracts data with confidence indicator and quick-edit
7. **Feedback input** — three focused signals: energy on rides, gut comfort, hunger
8. **Daily compliance signal** — yes/mostly/no
9. **Audio notes** — record and transcribe voice notes
10. **Daily dashboard** — session fuelling (hero), meals as named templates, supplements, calorie summary with reasoning, glycogen battery indicator
11. **Shopping list** — 3-day auto-generated list

### Post-MVP
- Weight projection graph
- Food photo analysis
- Sleep/stress tracking as structured inputs
- Long-term calendar trajectory view
- Multiple protocol files for season phases
- Expanded feedback dimensions
- Advanced profile learning (pattern detection across weeks/months)

### Explicitly Out of V1
- Recipe content or cooking instructions — this is not a recipe app
- Social features
- Coach/multi-user access
- API integrations (Strava, Garmin) — screenshots first, APIs later if needed
