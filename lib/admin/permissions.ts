/**
 * Admin v1 permission catalog. Keys are stored on `admin_roles.permissions`
 * (text[]). The wildcard `*` grants everything (superadmin). Keep this list in
 * sync with the seed in `scripts/admin-rbac.sql`.
 */

export const ADMIN_PERMISSIONS = [
  'users.read',
  'users.write',
  'points.grant',
  'referrals.read',
  'referrals.payout',
  'cashback.grant',
  'packs.read',
  'packs.override',
  'packs.override.approve',
  'campaigns.read',
  'campaigns.grant',
  'flags.read',
  'flags.write',
  'bugreports.read',
  'bugreports.write',
  'identity.read',
  'identity.write',
  'championship.read',
  'championship.review',
  'championship.finalize',
  'audit.read',
  'admins.read',
  'admins.write',
  // Emergency account controls (freeze/release a user's trading + automation).
  // Superadmin-only by design — not seeded onto support/economy/reviewer roles.
  'account.control',
  // Server-signed protective sells (Privy embedded wallets with app signer only).
  'account.emergency_sell',
  // Global emergency control system: kill switches (trading/AI/packs/cashback/
  // referral), per-chain pauses, maintenance + read-only mode, emergency banner.
  // Superadmin-only by design — this can halt the whole platform.
  'emergency.control',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_WILDCARD = '*';

/** True if the effective permission set satisfies `required`. */
export function hasPermission(
  effective: readonly string[],
  required: AdminPermission,
): boolean {
  if (effective.includes(ADMIN_WILDCARD)) return true;
  return effective.includes(required);
}

/** Union role permission lists into a deduped effective set. */
export function unionPermissions(lists: readonly (readonly string[])[]): string[] {
  const set = new Set<string>();
  for (const list of lists) for (const p of list) set.add(p);
  return [...set];
}
