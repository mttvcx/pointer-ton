import {
  fetchMetaAndAssetCtxs,
  fetchL2Book,
  fundingCountdownLabel,
  hourlyFundingToApr,
} from '@/lib/hyperliquid/infoClient';
import { perpCoinIcon, perpMarketId, perpTvSymbol } from '@/lib/perps/coinMeta';
import type { PerpMarket, PerpsL2Book, PerpsL2Level } from '@/lib/perps/types';

function num(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function buildMarketsFromMeta(meta: Awaited<ReturnType<typeof fetchMetaAndAssetCtxs>>): PerpMarket[] {
  const [head, ctxs] = meta;
  const countdown = fundingCountdownLabel();

  return head.universe.map((u, i) => {
    const ctx = ctxs[i];
    if (!ctx) {
      return null;
    }
    const mark = num(ctx.markPx);
    const prev = num(ctx.prevDayPx);
    const chg24 = prev > 0 ? ((mark - prev) / prev) * 100 : 0;
    const fundingHourly = num(ctx.funding);
    const oiCoin = num(ctx.openInterest);
    const oiUsd = oiCoin * mark;
    const vol24Usd = num(ctx.dayNtlVlm);

    return {
      id: perpMarketId(u.name),
      coin: u.name,
      label: `${u.name}-USD`,
      iconSrc: perpCoinIcon(u.name),
      tvSymbol: perpTvSymbol(u.name),
      mark,
      oraclePx: num(ctx.oraclePx) || mark,
      chg24,
      fundingHourly,
      fundingApr: hourlyFundingToApr(fundingHourly),
      fundingCountdown: countdown,
      oiUsd,
      vol24Usd,
      maxLeverage: u.maxLeverage,
    } satisfies PerpMarket;
  }).filter((m): m is PerpMarket => m != null && m.mark > 0);
}

export async function getPerpMarkets(): Promise<PerpMarket[]> {
  const meta = await fetchMetaAndAssetCtxs();
  const markets = buildMarketsFromMeta(meta);
  markets.sort((a, b) => b.vol24Usd - a.vol24Usd);
  return markets;
}

function parseLevels(raw: { px: string; sz: string; n: number }[]): PerpsL2Level[] {
  return raw.map((l) => ({
    px: num(l.px),
    sz: num(l.sz),
    n: l.n,
  }));
}

export async function getPerpL2Book(coin: string, markHint?: number): Promise<PerpsL2Book> {
  const book = await fetchL2Book(coin);
  const bids = parseLevels(book.levels[0] ?? []).sort((a, b) => b.px - a.px);
  const asks = parseLevels(book.levels[1] ?? []).sort((a, b) => a.px - b.px);
  const bestBid = bids[0]?.px ?? 0;
  const bestAsk = asks[0]?.px ?? 0;
  const mid =
    bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : (markHint ?? (bestAsk || bestBid));
  const spreadBps =
    mid > 0 && bestAsk > bestBid ? ((bestAsk - bestBid) / mid) * 10_000 : 0;

  return {
    coin: book.coin,
    bids,
    asks,
    spreadBps,
    mark: mid,
  };
}

export function fmtPerpUsdCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
