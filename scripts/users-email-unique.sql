-- BLOCKER-1 (privilege-escalation) defense-in-depth.
--
-- `users.email` is a privilege-bearing field: it drives admin bootstrap
-- (ADMIN_BOOTSTRAP_EMAILS) and subscription lookup. The primary fix makes the
-- value trustworthy (read from Privy's verified identity in /api/auth/sync, never
-- the client body). This UNIQUE index is the second layer: even a future bug can
-- no longer let two rows share an email, so an attacker cannot duplicate the
-- founder's address onto their own row.
--
-- Normalized (lower + btrim) to match the app's `.trim().toLowerCase()` and the
-- bootstrap/subscription comparisons. Partial: NULL/blank emails are unconstrained.
-- Verified no existing duplicates before applying (count = 0).
-- Apply ONCE (Supabase SQL editor or MCP). Idempotent.

create unique index if not exists users_email_lower_uniq
  on public.users (lower(btrim(email)))
  where email is not null and btrim(email) <> '';
