-- One-time: grant superadmin to an existing user by email (e.g. Gmail Privy login).
-- Run in Supabase SQL editor after admin-rbac.sql, then reload-postgrest-schema.sql.
--
-- Replace the email below, then execute.

DO $$
DECLARE
  v_user_id uuid;
  v_admin_id uuid;
  v_role_id uuid;
  v_email text := 'moustimail@gmail.com';
BEGIN
  SELECT id INTO v_user_id FROM users WHERE lower(trim(email)) = lower(trim(v_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user row for email %. Sign in once with Privy so /api/auth/sync creates the row.', v_email;
  END IF;

  INSERT INTO admin_users (user_id, is_active, notes)
  VALUES (v_user_id, true, 'manual grant by email')
  ON CONFLICT (user_id) DO UPDATE SET is_active = true
  RETURNING id INTO v_admin_id;

  SELECT id INTO v_role_id FROM admin_roles WHERE key = 'superadmin' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'superadmin role missing — run scripts/admin-rbac.sql first';
  END IF;

  INSERT INTO admin_user_roles (admin_user_id, role_id)
  VALUES (v_admin_id, v_role_id)
  ON CONFLICT (admin_user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Granted superadmin to user % (email %)', v_user_id, v_email;
END $$;
