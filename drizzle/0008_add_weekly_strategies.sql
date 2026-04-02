-- Add weekly_strategies table
CREATE TABLE IF NOT EXISTS weekly_strategies (
  id              SERIAL PRIMARY KEY,
  clerk_user_id   VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  week_overview   TEXT,
  -- Array of ingredient name strings
  ingredient_pool JSONB        NOT NULL DEFAULT '[]',
  -- Array of { item, category, amount }
  shopping_items  JSONB        NOT NULL DEFAULT '[]',
  -- Pending AI-proposed update awaiting user confirmation
  proposed_update JSONB,
  ai_reasoning    TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weekly_strategies_clerk_user_id_idx
  ON weekly_strategies(clerk_user_id);
