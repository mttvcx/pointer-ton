import {
  coerceHeliusEnhancedTx,
} from '@/lib/indexer/qaMintIngest';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import type { HeliusEnhancedTx } from '@/lib/indexer/heliusEnhanced';
import type { ParsedMintSwap } from '@/lib/indexer/types';

const WSOL = 'So11111111111111111111111111111111111111112';

function mintsInTx(tx: HeliusEnhancedTx): string[] {
  const set = new Set<string>();
  for (const leg of tx.tokenTransfers ?? []) {
    const mint = leg.mint?.trim();
    if (!mint || mint === WSOL) continue;
    if ((leg.tokenAmount ?? 0) > 0) set.add(mint);
  }
  return [...set];
}

/** Parse swap legs for a tracked-wallet enhanced tx (no synthetic data). */
export function parseTrackedWalletSwapsFromTx(txRaw: unknown): ParsedMintSwap[] {
  const tx = coerceHeliusEnhancedTx(txRaw);
  if (!tx?.feePayer?.trim()) return [];

  const out: ParsedMintSwap[] = [];
  for (const mint of mintsInTx(tx)) {
    const parsed = parseSwapFromEnhancedTx({ tx, mint, decimals: 6 });
    if (parsed.ok && parsed.swap.eventKind === 'swap') {
      out.push(parsed.swap);
    }
  }
  return out;
}
