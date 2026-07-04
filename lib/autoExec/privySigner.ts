import 'server-only';

/**
 * ⚠️ MONEY PATH — NOT IMPLEMENTED. Delegated server-side signing for a user's
 * Privy embedded Solana wallet (session signer). Deliberately unimplemented so
 * the auto-execution engine CANNOT move real funds until a security review lands
 * a verified implementation here.
 *
 * What the reviewed implementation must do (verify against @privy-io/node docs):
 *   1. Confirm the user granted a session signer for this wallet
 *      (session_signers row, status='active') — never sign without it.
 *   2. Build the swap tx server-side (reuse the /api/trade quote path), then sign
 *      it with the app's Privy authorization key via @privy-io/node walletApi for
 *      Solana. The authorization key + app secret come from env
 *      (PRIVY_APP_ID / PRIVY_APP_SECRET / PRIVY_AUTHORIZATION_KEY) — server only.
 *   3. Enforce Privy on-wallet policy IDs as a second wall (per-tx caps) in
 *      addition to our own guardrails.
 *   4. Broadcast + confirm; return the signature.
 *
 * Security review checklist (must pass before enabling):
 *   - signer bound to the exact delegated wallet; no cross-user signing
 *   - amount/mint/slippage bounds validated server-side pre-sign
 *   - guardrail reservation already succeeded (caller enforces) — re-assert here
 *   - revoked delegation (status!='active') hard-blocks
 *   - full audit log of every sign attempt
 */

export type DelegatedSignInput = {
  userId: string;
  walletAddress: string;
  mint: string;
  amountSol: number;
  slippageBps: number | null;
  side: 'buy' | 'sell';
};

export type DelegatedSignResult = { signature: string };

/** A verified Privy session signer is configured for server-side signing. */
export function delegatedSignerConfigured(): boolean {
  // Requires the reviewed implementation below AND the Privy authorization key env.
  return false;
}

export async function signDelegatedSwap(_input: DelegatedSignInput): Promise<DelegatedSignResult> {
  throw new Error('delegated_signer_not_implemented');
}
