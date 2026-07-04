import 'server-only';

import { getConnection } from '@/lib/solana/connection';

export type SolConfirmState = 'confirmed' | 'failed' | 'timeout';

/**
 * Poll a Solana signature to a terminal state:
 *  - 'confirmed' once it reaches confirmed/finalized commitment,
 *  - 'failed' if it landed with an on-chain error (revert / slippage),
 *  - 'timeout' if neither happens within `timeoutMs` (it may still confirm later).
 *
 * Used to gate trade recording/accrual on real confirmation. Mirrors the loop in
 * /api/solana/broadcast so both money paths confirm the same way.
 */
export async function waitForSolConfirmation(
  signature: string,
  timeoutMs = 12_000,
): Promise<SolConfirmState> {
  const conn = getConnection();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    let value: Awaited<ReturnType<typeof conn.getSignatureStatus>>['value'] | null = null;
    try {
      value = (await conn.getSignatureStatus(signature)).value;
    } catch {
      value = null;
    }
    if (value?.err) return 'failed';
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
      return 'confirmed';
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return 'timeout';
}
