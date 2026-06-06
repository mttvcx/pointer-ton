-- Admin v1 — Control Room RBAC + universal audit log.
-- Run in Supabase SQL editor, then run scripts/reload-postgrest-schema.sql.
--
-- Design: admins are *real* Privy users (FK -> users.id) flagged here. Roles
-- carry a permissions text[] (wildcard '*' = superadmin). Every admin mutation
-- writes one admin_audit_log row attributed to admin_user_id.

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,            -- wallet/username snapshot or 'system'
  action text NOT NULL,                 -- e.g. 'packs.override.create'
  target_type text NOT NULL,            -- e.g. 'user' | 'pack_override'
  target_id text,
  reason text,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log (target_type, target_id);

-- Seed the four canonical roles. Permission keys mirror lib/admin/permissions.ts.
INSERT INTO admin_roles (key, name, description, permissions) VALUES
  ('superadmin', 'Super Admin', 'Full access to every control-room action.', ARRAY['*']),
  ('support', 'Support', 'Read user data and triage bug reports.',
    ARRAY['users.read','referrals.read','packs.read','bugreports.read','bugreports.write','identity.read','campaigns.read','championship.read','audit.read']),
  ('economy', 'Economy', 'Manage points, referrals, cashback, campaigns and pack overrides.',
    ARRAY['users.read','points.grant','referrals.read','referrals.payout','cashback.grant','campaigns.read','campaigns.grant','packs.read','packs.override','flags.read','audit.read']),
  ('reviewer', 'Reviewer', 'Review/finalize championship and approve pack overrides.',
    ARRAY['users.read','championship.read','championship.review','championship.finalize','packs.read','packs.override.approve','audit.read'])
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      permissions = EXCLUDED.permissions;

NOTIFY pgrst, 'reload schema';
