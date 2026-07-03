import { api } from '../api/client';

/**
 * Bind the logged-in Privy identity to its Pointer account.
 *
 * Web and mobile share ONE Privy app, so the same Google / Apple / email login
 * resolves to the same `privy_id`. Calling this after login lands you on the SAME
 * account you already use on pointer.trade — if you signed up on the web with
 * Google, signing in with that Google here connects you straight to it — and pulls
 * your embedded Solana + EVM wallets into it. Mirrors web's useAuthSync:
 *   POST /api/auth/sync        → upsert the Pointer user by privy_id
 *   POST /api/wallets/sync-privy → import the embedded wallets (read server-side)
 *
 * Email is deliberately NOT sent — the server reads it from the verified Privy
 * profile (client-supplied email would be a privilege-escalation vector).
 */
export async function syncPointerAccount(
  token: string,
  opts: { walletAddress?: string | null; username?: string | null } = {},
): Promise<void> {
  await api('/api/auth/sync', {
    token,
    method: 'POST',
    body: { walletAddress: opts.walletAddress ?? null, username: opts.username ?? null },
  });
  // Fire-and-forget: the server reads the embedded wallets from the verified Privy
  // profile, so a failure here shouldn't block the user getting into the app.
  await api('/api/wallets/sync-privy', { token, method: 'POST', body: {} }).catch(() => undefined);
}
