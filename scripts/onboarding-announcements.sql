-- First-time tutorial + feature announcements (run in Supabase SQL editor).

-- Users: spotlight tutorial completion (types may already expect these columns).
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0;

-- Feature announcements (insert rows when ready; none shipped by default).
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  slug text NOT NULL UNIQUE,
  headline text NOT NULL,
  description text NOT NULL,
  video_url text,
  show_from timestamptz NOT NULL,
  show_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_show_from ON announcements (show_from);

CREATE TABLE IF NOT EXISTS user_announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES announcements (id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_uad_user ON user_announcement_dismissals (user_id);
