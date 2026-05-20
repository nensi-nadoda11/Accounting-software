ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "remember_me" boolean NOT NULL DEFAULT false;
