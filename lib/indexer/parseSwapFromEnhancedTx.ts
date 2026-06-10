import { LAUNCHPAD_PROGRAM_IDS, MIGRATION_PROGRAM_IDS } from '@/lib/utils/constants';
import {
  grossSolFlow,
  nativeSolDelta,
  type HeliusEnhancedTx,
  type HeliusTokenTransfer,
} from '@/lib/indexer/heliusEnhanced';
import type { MintSwapEventKind, ParsedMintSwap } from '@/lib/indexer/types';

const PUMP_PROGRAMS = new Set<string>([
  LAUNCHPAD_PROGRAM_IDS.pumpFun,
  MIGRATION_PROGRAM_IDS.pumpSwap,
]);

const POOL_LIKE = new Set<string>();

const LIQ_EVENT_TYPES = new Set([
  'WITHDRAW',
  'REMOVE_LIQUIDITY',
  'REMOVE_LIQ',
  'CLOSE_ACCOUNT',
  'UNKNOWN',
]);

/** Minimum SOL received to treat as remove-liq (filters dust). */
const MIN_REMOVE_LIQ_SOL = 0.5;

function isPoolAccount(addr: string | undefined, poolHint: string | null): boolean {
  if (!addr) return false;
  if (poolHint && addr === poolHint) return true;
  return POOL_LIKE.has(addr);
}

function grossSolReceived(tx: HeliusEnhancedTx, wallet: string): number {
  let lamports = 0;
  for (const n of tx.nativeTransfers ?? []) {
    const amt = n.amount ?? 0;
    if (amt <= 0) continue;
    if (n.toUserAccount === wallet) lamports += amt;
  }
  return lamports / 1e9;
}

function sumMintTokenFromPool(
  tx: HeliusEnhancedTx,
  mint: string,
  poolHint: string | null,
  wallet: string,
): number {
  let total = 0;
  for (const leg of tx.tokenTransfers ?? []) {
    if (leg.mint !== mint) continue;
    const amt = leg.tokenAmount ?? 0;
    if (amt <= 0) continue;
    const fromPool =
      isPoolAccount(leg.fromUserAccount, poolHint) ||
      (poolHint && leg.fromTokenAccount && leg.fromUserAccount !== wallet);
    if (fromPool && leg.toUserAccount === wallet) total += amt;
  }
  return total;
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

function pickPrimaryMintTransfer(
  tx: HeliusEnhancedTx,
  mint: string,
  wallet: string,
): { transfer: HeliusTokenTransfer; side: 'buy' | 'sell' } | null {
  const legs = (tx.tokenTransfers ?? []).filter(
    (t) => t.mint === mint && (t.tokenAmount ?? 0) > 0,
  );
  if (legs.length === 0) return null;

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

function tryParseRemoveLiquidity(params: {
  tx: HeliusEnhancedTx;
  mint: string;
  poolHint?: string | null;
  decimals?: number;
}): ParsedMintSwap | null {
  const { tx, mint } = params;
  const sig = tx.signature?.trim();
  const wallet = tx.feePayer?.trim();
  if (!sig || !wallet) return null;

  const poolAddress = params.poolHint ?? inferPoolAddress(tx, mint);
  if (poolAddress) POOL_LIKE.add(poolAddress);

  const solReceived = grossSolReceived(tx, wallet);
  const tokenFromPool = sumMintTokenFromPool(tx, mint, poolAddress, wallet);

  const poolInvolved = Boolean(
    poolAddress &&
      (tx.tokenTransfers ?? []).some(
        (l) =>
          l.mint === mint &&
          (l.fromUserAccount === poolAddress ||
            l.toUserAccount === poolAddress ||
            isPoolAccount(l.fromUserAccount, poolAddress) ||
            isPoolAccount(l.toUserAccount, poolAddress)),
      ),
  );

  const typedLiq =
    tx.type != null && tx.type !== 'SWAP' && LIQ_EVENT_TYPES.has(tx.type) && solReceived >= MIN_REMOVE_LIQ_SOL;

  const poolSolWithdraw =
    Boolean(poolAddress) &&
    (tx.nativeTransfers ?? []).some((n) => {
      const sol = (n.amount ?? 0) / 1e9;
      return (
        sol >= MIN_REMOVE_LIQ_SOL &&
        n.toUserAccount === wallet &&
        (n.fromUserAccount === poolAddress || isPoolAccount(n.fromUserAccount, poolAddress))
      );
    });

  const patternLiq =
    poolInvolved &&
    solReceived >= MIN_REMOVE_LIQ_SOL &&
    (tokenFromPool > 0 || (tx.type != null && tx.type !== 'SWAP') || poolSolWithdraw);

  const ammMassWithdraw =
    poolSolWithdraw &&
    solReceived >= MIN_REMOVE_LIQ_SOL &&
    (tx.source === 'PUMP_AMM' || tx.source === 'PUMP_FUN' || tx.source === 'PUMP');

  if (!typedLiq && !patternLiq && !ammMassWithdraw) return null;

  const tsSec = tx.timestamp;
  if (tsSec == null || !Number.isFinite(tsSec)) return null;

  const decimals = params.decimals ?? 6;
  const tokenAmountUi = tokenFromPool > 0 ? tokenFromPool : 0;
  const tokenAmountRaw = tokenAmountUi * 10 ** decimals;

  return {
    mint,
    signature: sig,
    wallet,
    eventKind: 'remove_liq',
    side: 'sell',
    tokenAmountRaw,
    tokenAmountUi,
    solAmount: solReceived,
    usdAmount: null,
    priceUsd: null,
    marketCapUsd: null,
    blockTime: new Date(tsSec * 1000).toISOString(),
    slot: tx.slot ?? null,
    programId: detectProgramId(tx),
    poolAddress,
    source: tx.source ? `helius_${tx.source.toLowerCase()}_remove_liq` : 'helius_remove_liq',
  };
}

export type ParseSwapResult =
  | { ok: true; swap: ParsedMintSwap }
  | { ok: false; reason: string };

/**
 * Parse one Helius enhanced tx into a mint-scoped swap or liquidity event.
 * Returns failure reason instead of inventing data.
 */
export function parseSwapFromEnhancedTx(params: {
  tx: HeliusEnhancedTx;
  mint: string;
  poolHint?: string | null;
  solUsd?: number | null;
  supplyTokens?: number | null;
  decimals?: number;
  /** Last known MC before this tx — attached to remove-liq rows for desk context. */
  lastKnownMcUsd?: number | null;
}): ParseSwapResult {
  const { tx, mint } = params;
  const sig = tx.signature?.trim();
  if (!sig) return { ok: false, reason: 'missing_signature' };

  const wallet = tx.feePayer?.trim();
  if (!wallet) return { ok: false, reason: 'missing_fee_payer' };

  const removeLiq = tryParseRemoveLiquidity(params);
  if (removeLiq) {
    if (params.lastKnownMcUsd != null && Number.isFinite(params.lastKnownMcUsd)) {
      removeLiq.marketCapUsd = params.lastKnownMcUsd;
    }
    return { ok: true, swap: removeLiq };
  }

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

  let solAmount = grossSolFlow(tx, wallet, leg.side);
  if (!Number.isFinite(solAmount) || solAmount <= 0) {
    const fallback = Math.abs(nativeSolDelta(tx, wallet));
    if (!Number.isFinite(fallback) || fallback <= 0) {
      return { ok: false, reason: 'zero_sol_amount' };
    }
    solAmount = fallback;
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
      eventKind: 'swap',
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

/** Desk event kind from a trade row (chain indexer or Pointer fills). */
export function tradeRowEventKind(row: {
  event_kind?: MintSwapEventKind | string | null;
}): MintSwapEventKind {
  const k = row.event_kind;
  if (k === 'remove_liq' || k === 'add_liq' || k === 'swap') return k;
  return 'swap';
}
