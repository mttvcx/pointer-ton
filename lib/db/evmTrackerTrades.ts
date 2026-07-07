import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import type { TrackerTradeRow } from '@/lib/db/trackerTrades';

/**
 * EVM tracked-wallet trades adapter — the seam for ETH / Base / BNB.
 *
 * The Solana feed reads pre-indexed `mint_swaps` (filled by the Helius webhook).
 * There is no equivalent EVM swap index yet, so this is the single place to plug
 * an EVM trade source in. Until one is configured it returns [] (the UI shows an
 * honest "EVM trade source pending" state) — the wallets/groups/KOLs already work
 * on EVM; only the live *trades* wait on data.
 *
 * To go live, implement `fetchEvmSwaps` against whatever source we land on:
 *   - a provider adapter (Moralis / Alchemy "wallet swaps"), or
 *   - a keyless on-chain decode via viem + a public RPC, or
 *   - a new `evm_swaps` table populated by an ingest job (mirror of mint_swaps).
 * Return newest-first, deduped, already shaped as TrackerTradeRow.
 */

/** Whether an EVM trade source is wired up (env-gated so the UI can message honestly). */
export function evmTradesConfigured(): boolean {
  return (process.env.EVM_TRADES_SOURCE?.trim() ?? '') !== '';
}

export async function listEvmTrackedWalletTrades(
  _wallets: { address: string; label: string | null }[],
  _chain: Extract<AppChainId, 'eth' | 'bnb' | 'base'>,
  _limit = 40,
): Promise<TrackerTradeRow[]> {
  if (!evmTradesConfigured()) return [];
  // TODO(evm-trades): fetch + map from the configured EVM source into TrackerTradeRow[].
  // Shape parity with the Solana path — signature/wallet/mint/side/usdAmount/blockTime.
  return [];
}
