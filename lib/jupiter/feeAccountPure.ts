import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { SOL_MINT, isValidPublicKey } from '@/lib/utils/addresses';

export type JupiterFeeRoute = {
  inputMint: string;
  outputMint: string;
  swapMode?: 'ExactIn' | 'ExactOut';
};

/** Fee-collector wallet from env (`JUPITER_REFERRAL_ACCOUNT` / legacy `JUPITER_FEE_ACCOUNT`). */
export function jupiterFeeOwnerPubkey(): PublicKey | null {
  const raw =
    process.env.JUPITER_REFERRAL_ACCOUNT?.trim() ||
    process.env.JUPITER_FEE_ACCOUNT?.trim();
  if (!raw || !isValidPublicKey(raw)) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

/** Optional explicit SPL token account override (already initialized). */
export function jupiterFeeTokenAccountOverride(): string | null {
  const raw = process.env.JUPITER_FEE_TOKEN_ACCOUNT?.trim();
  if (!raw || !isValidPublicKey(raw)) return null;
  return raw;
}

/**
 * Mint Jupiter collects platform fees in for this route.
 * ExactIn SOL↔meme uses wrapped SOL so one ATA covers almost all Pointer trades.
 */
export function resolveJupiterFeeMint(route: JupiterFeeRoute): string {
  if (route.swapMode === 'ExactOut') return route.inputMint;
  if (route.inputMint === SOL_MINT || route.outputMint === SOL_MINT) return SOL_MINT;
  return route.outputMint;
}

/** Derive the fee-collector ATA for a swap route (may be uninitialized on-chain). */
export function deriveJupiterFeeTokenAccount(route: JupiterFeeRoute): string | null {
  const override = jupiterFeeTokenAccountOverride();
  if (override) return override;

  const owner = jupiterFeeOwnerPubkey();
  if (!owner) return null;

  const feeMint = new PublicKey(resolveJupiterFeeMint(route));
  const allowOwnerOffCurve = !PublicKey.isOnCurve(owner.toBytes());
  return getAssociatedTokenAddressSync(
    feeMint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  ).toBase58();
}

export function jupiterQuoteHasPlatformFee(quoteResponse: unknown): boolean {
  if (!quoteResponse || typeof quoteResponse !== 'object') return false;
  const pf = (quoteResponse as Record<string, unknown>).platformFee;
  if (pf == null) return false;
  if (typeof pf === 'object') return true;
  return typeof pf === 'number' && pf > 0;
}

export function jupiterFeeRouteFromQuote(quoteResponse: unknown): JupiterFeeRoute | null {
  if (!quoteResponse || typeof quoteResponse !== 'object') return null;
  const q = quoteResponse as Record<string, unknown>;
  const inputMint = typeof q.inputMint === 'string' ? q.inputMint : null;
  const outputMint = typeof q.outputMint === 'string' ? q.outputMint : null;
  if (!inputMint || !outputMint) return null;
  const swapMode =
    q.swapMode === 'ExactOut' ? ('ExactOut' as const) : ('ExactIn' as const);
  return { inputMint, outputMint, swapMode };
}

export function isInvalidFeeTokenAccountSimError(simulationError: unknown): boolean {
  const raw = JSON.stringify(simulationError ?? '').toLowerCase();
  return (
    raw.includes('0x1789') ||
    raw.includes('invalidtokenaccount') ||
    raw.includes('6025')
  );
}

/** Jupiter sometimes returns a valid tx when its server-side sim RPC hiccups. */
export function isJupiterSimulationRpcNoise(simulationError: unknown): boolean {
  const raw = JSON.stringify(simulationError ?? '').toLowerCase();
  return raw.includes('failed_to_simulate') || raw.includes('rpc failed');
}
