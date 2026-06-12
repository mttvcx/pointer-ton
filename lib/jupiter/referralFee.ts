import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from '@/lib/solana/connection';
import {
  deriveJupiterFeeTokenAccount,
  jupiterFeeTokenAccountOverride,
  type JupiterFeeRoute,
} from '@/lib/jupiter/feeAccountPure';

export {
  deriveJupiterFeeTokenAccount,
  isInvalidFeeTokenAccountSimError,
  isJupiterSimulationRpcNoise,
  jupiterFeeOwnerPubkey,
  jupiterFeeRouteFromQuote,
  jupiterFeeTokenAccountOverride,
  jupiterQuoteHasPlatformFee,
  resolveJupiterFeeMint,
  type JupiterFeeRoute,
} from '@/lib/jupiter/feeAccountPure';

export async function jupiterFeeTokenAccountReady(feeAccount: string): Promise<boolean> {
  try {
    const info = await getConnection().getAccountInfo(new PublicKey(feeAccount), 'confirmed');
    return info != null && info.owner.equals(TOKEN_PROGRAM_ID);
  } catch {
    return false;
  }
}

/** Fee ATA for this route, or null when fee owner is not configured. */
export async function resolveJupiterFeeAccountForSwap(
  route: JupiterFeeRoute,
): Promise<string | null> {
  return deriveJupiterFeeTokenAccount(route);
}

/** @deprecated Use {@link resolveJupiterFeeAccountForSwap}. */
export function jupiterReferralFeeAccount(): string | null {
  return jupiterFeeTokenAccountOverride();
}
