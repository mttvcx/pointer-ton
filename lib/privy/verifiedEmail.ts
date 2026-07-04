/**
 * Pure: pick the trusted, verified email from a Privy user's linked accounts.
 *
 * SECURITY (BLOCKER-1 fix): a user's email drives admin bootstrap
 * (`ADMIN_BOOTSTRAP_EMAILS`) and subscription lookup, so it MUST come from
 * Privy's verified identity — never from the client-supplied `/api/auth/sync`
 * body. Before this, the sync route wrote `body.email` straight to `users.email`,
 * letting any authenticated user set their email to a bootstrap address and
 * self-escalate to superadmin. This extractor is the only trusted source.
 *
 * Email-OTP login → `{ type: 'email', address }`; Google/Apple OAuth →
 * `{ type: 'google_oauth' | 'apple_oauth', email }`. Result is trimmed +
 * lowercased to match `ADMIN_BOOTSTRAP_EMAILS` / subscription normalization.
 */
export function pickVerifiedEmail(linkedAccounts: unknown): string | null {
  if (!Array.isArray(linkedAccounts)) return null;

  // Deterministic preference (explicit email > Google > Apple) regardless of the
  // order Privy returns accounts in.
  const order = ['email', 'google_oauth', 'apple_oauth'] as const;
  for (const want of order) {
    for (const acct of linkedAccounts) {
      if (!acct || typeof acct !== 'object') continue;
      const a = acct as Record<string, unknown>;
      if (a.type !== want) continue;
      const raw = want === 'email' ? a.address : a.email;
      if (typeof raw === 'string') {
        const email = raw.trim().toLowerCase();
        // Minimal sanity — a real address has an `@` and something either side.
        if (/^[^@\s]+@[^@\s]+$/.test(email)) return email;
      }
    }
  }
  return null;
}
