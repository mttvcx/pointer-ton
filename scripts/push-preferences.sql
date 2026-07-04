-- Per-account push notification toggles (tracked-wallet / X-monitor / price /
-- auto-buy-fill). Shared by web + mobile. Applied to prod (ajngsbnwtkmkvbgpntkd)
-- via Supabase MCP migration `push_preferences`.
CREATE TABLE IF NOT EXISTS push_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tracked_wallet boolean NOT NULL DEFAULT true,
  x_monitor boolean NOT NULL DEFAULT true,
  price boolean NOT NULL DEFAULT true,
  auto_buy_fill boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE push_preferences ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
