import 'server-only';

import type { Tables } from '@/lib/supabase/types';
import { listConfirmedTradesForUserAsc, listTradesForUser } from '@/lib/db/trades';
import { fetchTonUsdFromCoinGecko, fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import type { PositionMark } from '@/lib/portfolio/fifoPnl';
import {
  fifoClosedSellsAndOpenLots,
  markOpenPositions,
  sumUnrealizedUsd,
  totalPortfolioUsd,
} from '@/lib/portfolio/fifoPnl';

type TradeRow = Tables<'trades'>;

type Holding = {
  mint: string;
  rawAmount: string;
  symbol: string | null;
  decimals: number;
  imageUrl: string | null;
};

export type PortfolioSnapshot = {
  solUsd: number | null;
  summary: {
    totalValueUsd: number | null;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    totalPnlUsd: number;
    realizedPnlSol: number;
  };
  positions: PositionMark[];
  closedSells: Array<{
    tradeId: string;
    mint: string;
    submittedAt: string;
    confirmedAt: string | null;
    txSignature: string;
    amountTokenRaw: string;
    solProceeds: number;
    costBasisSol: number;
    realizedPnlSol: number;
    realizedPnlUsd: number;
    solProceedsUsd: number;
    costBasisUsd: number;
  }>;
  tradesRecent: TradeRow[];
};

export async function buildPortfolioSnapshot(params: {
  userId: string;
  solLamports: string | null;
  holdings: Holding[];
  recentTradeLimit: number;
  fifoTradeLimit: number;
}): Promise<PortfolioSnapshot> {
  const { userId, solLamports, holdings, recentTradeLimit, fifoTradeLimit } = params;

  const [tradesRecent, tradesAsc] = await Promise.all([
    listTradesForUser(userId, recentTradeLimit),
    listConfirmedTradesForUserAsc(userId, fifoTradeLimit),
  ]);

  const mints = new Set<string>();
  for (const h of holdings) mints.add(h.mint);
  for (const t of tradesAsc) mints.add(t.mint);

  const [priceMap, tonQuote] = await Promise.all([
    fetchUsdPricesForMints([...mints]),
    fetchTonUsdFromCoinGecko(),
  ]);
  const solUsd = tonQuote.usdPrice;

  const { closedSells, openByMint, realizedPnlSol } = fifoClosedSellsAndOpenLots(tradesAsc);

  const tokenUsdByMint = new Map<string, number | null>();
  for (const m of mints) {
    tokenUsdByMint.set(m, priceMap.get(m)?.usdPrice ?? null);
  }

  const positions = markOpenPositions({
    holdings,
    solLamports,
    openByMint,
    solUsd,
    tokenUsdByMint,
  });

  const totalVal = totalPortfolioUsd(positions);
  const unrealizedUsd = sumUnrealizedUsd(positions);
  const realizedUsd =
    solUsd != null && Number.isFinite(solUsd) ? realizedPnlSol * solUsd : 0;

  const closedSellsOut = [...closedSells]
    .reverse()
    .map((c) => ({
      tradeId: c.tradeId,
      mint: c.mint,
      submittedAt: c.submittedAt,
      confirmedAt: c.confirmedAt,
      txSignature: c.txSignature,
      amountTokenRaw: c.amountTokenRaw,
      solProceeds: c.solProceeds,
      costBasisSol: c.costBasisSol,
      realizedPnlSol: c.realizedPnlSol,
      realizedPnlUsd:
        solUsd != null && Number.isFinite(solUsd) ? c.realizedPnlSol * solUsd : 0,
      solProceedsUsd:
        solUsd != null && Number.isFinite(solUsd) ? c.solProceeds * solUsd : 0,
      costBasisUsd:
        solUsd != null && Number.isFinite(solUsd) ? c.costBasisSol * solUsd : 0,
    }));

  return {
    solUsd,
    summary: {
      totalValueUsd: totalVal,
      realizedPnlUsd: realizedUsd,
      unrealizedPnlUsd: unrealizedUsd,
      totalPnlUsd: realizedUsd + unrealizedUsd,
      realizedPnlSol,
    },
    positions,
    closedSells: closedSellsOut,
    tradesRecent,
  };
}
