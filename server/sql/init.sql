-- Location history table
-- user_id stores Clerk userId (user_xxx) directly — no users table needed.
CREATE TABLE IF NOT EXISTS location_history (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(255) NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  event_id    VARCHAR(255) UNIQUE,   -- for Kafka deduplication
  recorded_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_location_history_user_id   ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at ON location_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_event_id  ON location_history(event_id);