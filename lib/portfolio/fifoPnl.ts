import type { Tables } from '@/lib/supabase/types';
import { lamportsToSol, rawToUi } from '@/lib/utils/formatters';

type TradeRow = Tables<'trades'>;

export type ClosedSellLot = {
  tradeId: string;
  mint: string;
  submittedAt: string;
  confirmedAt: string | null;
  txSignature: string;
  amountTokenRaw: string;
  /** SOL received for the swap (approx., from stored trade). */
  solProceeds: number;
  /** FIFO-matched cost of tokens sold, SOL. */
  costBasisSol: number;
  realizedPnlSol: number;
};

export type OpenLotState = {
  mint: string;
  lots: { remaining: bigint; costSol: number }[];
};

function solNotionalForTrade(t: TradeRow, side: 'buy' | 'sell'): number {
  if (t.amount_sol != null && Number.isFinite(t.amount_sol) && t.amount_sol > 0) {
    return t.amount_sol;
  }
  try {
    if (side === 'buy') {
      return lamportsToSol(BigInt(t.amount_in_raw));
    }
    return lamportsToSol(BigInt(t.amount_out_raw));
  } catch {
    return 0;
  }
}

function takeFromLots(
  lots: { remaining: bigint; costSol: number }[],
  takeRaw: bigint,
): { costSol: number; unconsumed: bigint } {
  let need = takeRaw;
  let costSol = 0;
  while (need > 0n && lots.length > 0) {
    const head = lots[0]!;
    if (head.remaining <= 0n) {
      lots.shift();
      continue;
    }
    const chunk = need < head.remaining ? need : head.remaining;
    const ratio = Number(chunk) / Number(head.remaining);
    const chunkCost = head.costSol * ratio;
    costSol += chunkCost;
    head.costSol -= chunkCost;
    head.remaining -= chunk;
    need -= chunk;
    if (head.remaining === 0n) lots.shift();
  }
  return { costSol, unconsumed: need };
}

/**
 * FIFO in SOL notional, confirmed trades only. USD figures are spot marks via caller.
 */
export function fifoClosedSellsAndOpenLots(tradesAsc: TradeRow[]): {
  closedSells: ClosedSellLot[];
  openByMint: Map<string, { remaining: bigint; costSol: number }[]>;
  realizedPnlSol: number;
} {
  const openByMint = new Map<string, { remaining: bigint; costSol: number }[]>();
  const closedSells: ClosedSellLot[] = [];
  let realizedPnlSol = 0;

  const getLots = (mint: string) => {
    let v = openByMint.get(mint);
    if (!v) {
      v = [];
      openByMint.set(mint, v);
    }
    return v;
  };

  for (const t of tradesAsc) {
    if (t.status !== 'confirmed') continue;
    if (t.tx_signature.startsWith('failed:')) continue;

    const mint = t.mint;
    if (t.side === 'buy') {
      let tokensOut: bigint;
      try {
        tokensOut = BigInt(t.amount_out_raw);
      } catch {
        continue;
      }
      if (tokensOut <= 0n) continue;
      const solIn = solNotionalForTrade(t, 'buy');
      getLots(mint).push({ remaining: tokensOut, costSol: solIn });
      continue;
    }

    // sell
    let tokensIn: bigint;
    try {
      tokensIn = BigInt(t.amount_in_raw);
    } catch {
      continue;
    }
    if (tokensIn <= 0n) continue;
    const solOut = solNotionalForTrade(t, 'sell');
    const lots = getLots(mint);
    const { costSol, unconsumed } = takeFromLots(lots, tokensIn);
    // Treat unmatched quantity as zero cost (e.g. tokens not acquired via Pointer).
    void unconsumed;
    const pnl = solOut - costSol;
    realizedPnlSol += pnl;
    closedSells.push({
      tradeId: t.id,
      mint,
      submittedAt: t.submitted_at,
      confirmedAt: t.confirmed_at,
      txSignature: t.tx_signature,
      amountTokenRaw: t.amount_in_raw,
      solProceeds: solOut,
      costBasisSol: costSol,
      realizedPnlSol: pnl,
    });
  }

  return { closedSells, openByMint, realizedPnlSol };
}

export type PositionMark = {
  mint: string;
  balanceRaw: string;
  decimals: number;
  symbol: string | null;
  imageUrl: string | null;
  costBasisSol: number;
  costBasisUsd: number;
  valueUsd: number | null;
  unrealizedPnlUsd: number | null;
  /** Weighted average entry (SOL per 1 UI token), when computable. */
  avgEntrySolPerUiToken: number | null;
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export function markOpenPositions(params: {
  holdings: Array<{
    mint: string;
    rawAmount: string;
    symbol: string | null;
    decimals: number;
    imageUrl: string | null;
  }>;
  solLamports: string | null;
  openByMint: Map<string, { remaining: bigint; costSol: number }[]>;
  solUsd: number | null;
  tokenUsdByMint: Map<string, number | null>;
}): PositionMark[] {
  const { holdings, solLamports, openByMint, solUsd, tokenUsdByMint } = params;
  const out: PositionMark[] = [];

  if (solLamports != null) {
    try {
      const solBal = lamportsToSol(BigInt(solLamports));
      const su = solUsd;
      const valueUsd = su != null && Number.isFinite(su) ? solBal * su : null;
      out.push({
        mint: SOL_MINT,
        balanceRaw: solLamports,
        decimals: 9,
        symbol: 'SOL',
        imageUrl: null,
        costBasisSol: 0,
        costBasisUsd: 0,
        valueUsd,
        unrealizedPnlUsd: null,
        avgEntrySolPerUiToken: null,
      });
    } catch {
      /* skip malformed */
    }
  }

  for (const h of holdings) {
    let balRaw: bigint;
    try {
      balRaw = BigInt(h.rawAmount);
    } catch {
      continue;
    }
    if (balRaw <= 0n) continue;

    const lots = openByMint.get(h.mint) ?? [];
    let expectedRaw = 0n;
    let costSol = 0;
    for (const l of lots) {
      expectedRaw += l.remaining;
      costSol += l.costSol;
    }

    if (expectedRaw > 0n) {
      const ratio = Number(balRaw) / Number(expectedRaw);
      if (Number.isFinite(ratio) && ratio > 0) {
        if (ratio <= 1) {
          costSol *= ratio;
        }
        // ratio > 1: extra tokens beyond tracked lots have no allocated cost (costSol unchanged).
      }
    } else {
      costSol = 0;
    }

    const su = solUsd;
    const costBasisUsd =
      su != null && Number.isFinite(su) && Number.isFinite(costSol) ? costSol * su : 0;

    const px = tokenUsdByMint.get(h.mint) ?? null;
    const ui = rawToUi(h.rawAmount, h.decimals);
    const valueUsd =
      px != null && Number.isFinite(px) && Number.isFinite(ui) ? ui * px : null;

    const unrealizedPnlUsd =
      valueUsd != null && Number.isFinite(valueUsd) ? valueUsd - costBasisUsd : null;

    let avgEntrySolPerUiToken: number | null = null;
    if (ui > 0 && costSol > 0 && Number.isFinite(ui)) {
      avgEntrySolPerUiToken = costSol / ui;
    }

    out.push({
      mint: h.mint,
      balanceRaw: h.rawAmount,
      decimals: h.decimals,
      symbol: h.symbol,
      imageUrl: h.imageUrl,
      costBasisSol: costSol,
      costBasisUsd,
      valueUsd,
      unrealizedPnlUsd,
      avgEntrySolPerUiToken,
    });
  }

  return out;
}

export function sumUnrealizedUsd(positions: PositionMark[]): number {
  let s = 0;
  for (const p of positions) {
    if (p.mint === SOL_MINT) continue;
    if (p.unrealizedPnlUsd != null && Number.isFinite(p.unrealizedPnlUsd)) {
      s += p.unrealizedPnlUsd;
    }
  }
  return s;
}

export function totalPortfolioUsd(positions: PositionMark[]): number | null {
  let t = 0;
  let any = false;
  for (const p of positions) {
    if (p.valueUsd != null && Number.isFinite(p.valueUsd)) {
      t += p.valueUsd;
      any = true;
    }
  }
  return any ? t : null;
}
