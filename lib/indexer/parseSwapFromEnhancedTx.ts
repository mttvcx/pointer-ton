import { LAUNCHPAD_PROGRAM_IDS, MIGRATION_PROGRAM_IDS } from '@/lib/utils/constants';
import {
  grossSolFlow,
  type HeliusEnhancedTx,
  type HeliusTokenTransfer,
} from '@/lib/indexer/heliusEnhanced';
import type { ParsedMintSwap } from '@/lib/indexer/types';

const PUMP_PROGRAMS = new Set<string>([
  LAUNCHPAD_PROGRAM_IDS.pumpFun,
  MIGRATION_PROGRAM_IDS.pumpSwap,
]);

const POOL_LIKE = new Set<string>();

function isPoolAccount(addr: string | undefined, poolHint: string | null): boolean {
  if (!addr) return false;
  if (poolHint && addr === poolHint) return true;
  return POOL_LIKE.has(addr);
}

function pickPrimaryMintTransfer(
  tx: HeliusEnhancedTx,
  mint: string,
  wallet: string,
): { transfer: HeliusTokenTransfer; side: 'buy' | 'sell' } | null {
  const legs = (tx.tokenTransfers ?? []).filter(
    (t) => t.mint === mint && (t.tokenAmount ?? 0) > 0,
  );
  if (legs.length === 0) return null;

  // Prefer largest non-dust leg involving the trader wallet.
  const ranked = [...legs].sort((a, b) => (b.tokenAmount ?? 0) - (a.tokenAmount ?? 0));
  for (const leg of ranked) {
    if (leg.toUserAccount === wallet && leg.fromUserAccount !== wallet) {
      return { transfer: leg, side: 'buy' };
    }
    if (leg.fromUserAccount === wallet && leg.toUserAccount !== wallet) {
      return { transfer: leg, side: 'sell' };
    }
  }
  return null;
}

function detectProgramId(tx: HeliusEnhancedTx): string | null {
  for (const row of tx.accountData ?? []) {
    const acct = row.account;
    if (acct && PUMP_PROGRAMS.has(acct)) return acct;
  }
  if (tx.source === 'PUMP_AMM') return MIGRATION_PROGRAM_IDS.pumpSwap;
  if (tx.source === 'PUMP_FUN' || tx.source === 'PUMP') return LAUNCHPAD_PROGRAM_IDS.pumpFun;
  return null;
}

function inferPoolAddress(tx: HeliusEnhancedTx, mint: string): string | null {
  for (const leg of tx.tokenTransfers ?? []) {
    if (leg.mint !== mint) continue;
    const from = leg.fromUserAccount;
    const to = leg.toUserAccount;
    if (from && to && from !== to) {
      if (to.length >= 32 && from.length >= 32) {
        return to;
      }
    }
  }
  return null;
}

export type ParseSwapResult =
  | { ok: true; swap: ParsedMintSwap }
  | { ok: false; reason: string };

/**
 * Parse one Helius enhanced tx into a mint-scoped swap leg for QA indexer.
 * Returns failure reason instead of inventing data.
 */
export function parseSwapFromEnhancedTx(params: {
  tx: HeliusEnhancedTx;
  mint: string;
  poolHint?: string | null;
  solUsd?: number | null;
  supplyTokens?: number | null;
  decimals?: number;
}): ParseSwapResult {
  const { tx, mint } = params;
  const sig = tx.signature?.trim();
  if (!sig) return { ok: false, reason: 'missing_signature' };

  const wallet = tx.feePayer?.trim();
  if (!wallet) return { ok: false, reason: 'missing_fee_payer' };

  if (tx.type && tx.type !== 'SWAP' && tx.type !== 'UNKNOWN') {
    return { ok: false, reason: `skip_type_${tx.type}` };
  }

  const leg = pickPrimaryMintTransfer(tx, mint, wallet);
  if (!leg) return { ok: false, reason: 'no_mint_transfer_for_wallet' };

  const tokenAmountUi = leg.transfer.tokenAmount ?? 0;
  if (!Number.isFinite(tokenAmountUi) || tokenAmountUi <= 0) {
    return { ok: false, reason: 'zero_token_amount' };
  }

  const decimals = params.decimals ?? 6;
  const tokenAmountRaw = tokenAmountUi * 10 ** decimals;

  const solAmount = grossSolFlow(tx, wallet, leg.side);
  if (!Number.isFinite(solAmount) || solAmount <= 0) {
    return { ok: false, reason: 'zero_sol_amount' };
  }

  const solUsd = params.solUsd;
  const usdAmount = solUsd != null && solUsd > 0 ? solAmount * solUsd : null;
  const priceUsd =
    usdAmount != null && tokenAmountUi > 0 ? usdAmount / tokenAmountUi : null;
  const marketCapUsd =
    priceUsd != null && params.supplyTokens != null && params.supplyTokens > 0
      ? priceUsd * params.supplyTokens
      : null;

  const tsSec = tx.timestamp;
  if (tsSec == null || !Number.isFinite(tsSec)) {
    return { ok: false, reason: 'missing_timestamp' };
  }

  const poolAddress = params.poolHint ?? inferPoolAddress(tx, mint);
  if (poolAddress) POOL_LIKE.add(poolAddress);

  return {
    ok: true,
    swap: {
      mint,
      signature: sig,
      wallet,
      side: leg.side,
      tokenAmountRaw,
      tokenAmountUi,
      solAmount,
      usdAmount,
      priceUsd,
      marketCapUsd,
      blockTime: new Date(tsSec * 1000).toISOString(),
      slot: tx.slot ?? null,
      programId: detectProgramId(tx),
      poolAddress,
      source: tx.source ? `helius_${tx.source.toLowerCase()}` : 'helius_enhanced',
    },
  };
}
