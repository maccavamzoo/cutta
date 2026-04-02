-- ============================================================
-- reset-test-data.sql
-- Safe to run multiple times.
-- Does NOT touch user_profiles or protocols.
-- ============================================================


-- ── 1. Clear all transactional data ─────────────────────────

DELETE FROM fuelling_plans;
DELETE FROM food_log;
DELETE FROM compliance_log;
DELETE FROM feedback_log;
DELETE FROM training_log;
DELETE FROM audio_notes;
DELETE FROM shopping_lists;
DELETE FROM weekly_strategies;
DELETE FROM calendar_events;
DELETE FROM weight_log;


-- ── 2. Insert 12 days of weigh-ins ──────────────────────────
-- today - 12  →  today - 1  (yesterday)
-- Start: 78.0 kg / 15.0% bf   End: ~77.2 kg / ~14.7% bf
-- Realistic bounce pattern — not a straight line.

INSERT INTO weight_log (clerk_user_id, log_date, weighed_at, weight_kg, body_fat_pct)
VALUES
  -- day 1  (today - 12): baseline
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '12 days')::date,
    (CURRENT_DATE - INTERVAL '12 days')::timestamp + TIME '07:00:00',
    78.0, 15.0
  ),
  -- day 2  (today - 11): slight drop
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '11 days')::date,
    (CURRENT_DATE - INTERVAL '11 days')::timestamp + TIME '07:00:00',
    77.8, 14.9
  ),
  -- day 3  (today - 10): small bounce up (rest day effect)
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '10 days')::date,
    (CURRENT_DATE - INTERVAL '10 days')::timestamp + TIME '07:00:00',
    77.9, 15.0
  ),
  -- day 4  (today - 9): back down
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '9 days')::date,
    (CURRENT_DATE - INTERVAL '9 days')::timestamp + TIME '07:00:00',
    77.7, 14.9
  ),
  -- day 5  (today - 8): good drop after training
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '8 days')::date,
    (CURRENT_DATE - INTERVAL '8 days')::timestamp + TIME '07:00:00',
    77.5, 14.8
  ),
  -- day 6  (today - 7): holds steady
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '7 days')::date,
    (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:00:00',
    77.5, 14.8
  ),
  -- day 7  (today - 6): tiny uptick (sodium / weekend)
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '6 days')::date,
    (CURRENT_DATE - INTERVAL '6 days')::timestamp + TIME '07:00:00',
    77.6, 14.9
  ),
  -- day 8  (today - 5): corrects back down
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '5 days')::date,
    (CURRENT_DATE - INTERVAL '5 days')::timestamp + TIME '07:00:00',
    77.4, 14.8
  ),
  -- day 9  (today - 4): another small drop
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '4 days')::date,
    (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '07:00:00',
    77.3, 14.8
  ),
  -- day 10 (today - 3): flat
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '3 days')::date,
    (CURRENT_DATE - INTERVAL '3 days')::timestamp + TIME '07:00:00',
    77.3, 14.7
  ),
  -- day 11 (today - 2): slight bounce
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '2 days')::date,
    (CURRENT_DATE - INTERVAL '2 days')::timestamp + TIME '07:00:00',
    77.4, 14.8
  ),
  -- day 12 (yesterday): ends lower
  (
    (SELECT clerk_user_id FROM user_profiles LIMIT 1),
    (CURRENT_DATE - INTERVAL '1 day')::date,
    (CURRENT_DATE - INTERVAL '1 day')::timestamp + TIME '07:00:00',
    77.2, 14.7
  )
ON CONFLICT (clerk_user_id, log_date)
DO UPDATE SET
  weighed_at    = EXCLUDED.weighed_at,
  weight_kg     = EXCLUDED.weight_kg,
  body_fat_pct  = EXCLUDED.body_fat_pct;


-- ── 3. Update profile ────────────────────────────────────────
-- current_weight_kg = yesterday's weigh-in (77.2)
-- target_weight_kg  = 72.0
-- target_set_at     = 12 days ago (anchors the projection line)
-- weight_loss_rate  = moderate
-- onboarding_complete = true

UPDATE user_profiles
SET
  current_weight_kg     = 77.2,
  target_weight_kg      = 72.0,
  target_set_at         = (CURRENT_DATE - INTERVAL '12 days')::timestamp + TIME '07:00:00',
  weight_loss_rate      = 'moderate',
  onboarding_complete   = true,
  updated_at            = NOW();
