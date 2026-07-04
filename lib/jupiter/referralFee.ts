import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from '@/lib/solana/connection';
import { resolveMintTokenProgram } from '@/lib/solana/tokenProgram';
import { SOL_MINT } from '@/lib/utils/addresses';
import {
  deriveJupiterFeeTokenAccount,
  jupiterFeeTokenAccountOverride,
  resolveJupiterFeeMint,
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
    // Accept either token program — a token-2022 fee ATA (e.g. xStocks) is owned by
    // TOKEN_2022_PROGRAM_ID, not the classic SPL program.
    return (
      info != null &&
      (info.owner.equals(TOKEN_PROGRAM_ID) || info.owner.equals(TOKEN_2022_PROGRAM_ID))
    );
  } catch {
    return false;
  }
}

/** Token program of the mint Jupiter collects the platform fee in. Wrapped SOL —
 *  the fee mint for every SOL-leg trade — is classic SPL, so short-circuit it with
 *  NO RPC: existing SOL↔token trades are unaffected. Only a non-SOL fee mint (e.g.
 *  a token-2022 xStock on a USDC/token leg) hits the on-chain resolver. */
export async function resolveJupiterFeeMintTokenProgram(
  route: JupiterFeeRoute,
): Promise<PublicKey> {
  const feeMint = resolveJupiterFeeMint(route);
  if (feeMint === SOL_MINT) return TOKEN_PROGRAM_ID;
  return resolveMintTokenProgram(new PublicKey(feeMint));
}

/** Fee ATA for this route, or null when fee owner is not configured. Resolves the
 *  fee mint's token program so token-2022 fee mints derive the correct ATA. */
export async function resolveJupiterFeeAccountForSwap(
  route: JupiterFeeRoute,
): Promise<string | null> {
  const program = await resolveJupiterFeeMintTokenProgram(route);
  return deriveJupiterFeeTokenAccount(route, program);
}

/** @deprecated Use {@link resolveJupiterFeeAccountForSwap}. */
export function jupiterReferralFeeAccount(): string | null {
  return jupiterFeeTokenAccountOverride();
}
