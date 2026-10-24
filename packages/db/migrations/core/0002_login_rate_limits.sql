-- Forward-only security migration. Apply to exam_core only.
CREATE TABLE IF NOT EXISTS login_rate_limits(
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_rate_limits_updated_idx ON login_rate_limits(updated_at);
