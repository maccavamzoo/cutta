-- Add preferred_foods column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_foods text[];

-- Migrate foodProfile data into the flat columns
-- This merges gutTriggers + negative into food_exclusions (lowercased, deduplicated),
-- and positive into preferred_foods (original case, deduplicated)

UPDATE user_profiles
SET
  food_exclusions = (
    SELECT array_agg(DISTINCT lower_item)
    FROM (
      -- existing food_exclusions
      SELECT lower(unnest(food_exclusions)) AS lower_item
      UNION
      -- gutTriggers from foodProfile
      SELECT lower(jsonb_array_elements_text(food_profile->'gutTriggers')) AS lower_item
      WHERE food_profile->'gutTriggers' IS NOT NULL
        AND jsonb_array_length(food_profile->'gutTriggers') > 0
      UNION
      -- negative from foodProfile
      SELECT lower(jsonb_array_elements_text(food_profile->'negative')) AS lower_item
      WHERE food_profile->'negative' IS NOT NULL
        AND jsonb_array_length(food_profile->'negative') > 0
    ) combined
    WHERE lower_item IS NOT NULL
  ),
  preferred_foods = (
    SELECT array_agg(DISTINCT item)
    FROM (
      SELECT jsonb_array_elements_text(food_profile->'positive') AS item
    ) pos
    WHERE item IS NOT NULL
  ),
  food_profile = food_profile - 'gutTriggers' - 'negative' - 'positive'
WHERE food_profile IS NOT NULL;
