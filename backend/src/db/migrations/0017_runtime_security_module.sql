CREATE TABLE IF NOT EXISTS "request_rate_limits" (
  "key" text PRIMARY KEY,
  "scope" text NOT NULL,
  "identifier" text NOT NULL,
  "hit_count" integer NOT NULL DEFAULT 0,
  "window_started_at" timestamptz NOT NULL,
  "window_ends_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "request_rate_limits_scope_identifier_idx"
  ON "request_rate_limits" ("scope", "identifier");
CREATE INDEX IF NOT EXISTS "request_rate_limits_window_ends_at_idx"
  ON "request_rate_limits" ("window_ends_at");

CREATE TABLE IF NOT EXISTS "login_attempt_locks" (
  "key" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "failed_count" integer NOT NULL DEFAULT 0,
  "locked_until" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_attempt_locks_identifier_idx"
  ON "login_attempt_locks" ("identifier");
CREATE INDEX IF NOT EXISTS "login_attempt_locks_expires_at_idx"
  ON "login_attempt_locks" ("expires_at");
CREATE INDEX IF NOT EXISTS "login_attempt_locks_locked_until_idx"
  ON "login_attempt_locks" ("locked_until");
