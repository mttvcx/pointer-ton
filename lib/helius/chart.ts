import 'server-only';

import { subDays } from 'date-fns';
import { inferMintKind } from '@/lib/chains/mintKind';
import { fetchDexScreenerSpotUsd } from '@/lib/market/dexscreenerPulse';
import { fetchTonApiJettonUsdPrice } from '@/lib/ton/tonApi';
import { listSnapshotsForMintRange, type TokenMarketSnapshotRow } from '@/lib/db/tokens';

export type ChartInterval = '1s' | '3m' | '1m' | '5m' | '15m' | '1h' | '1d' | '5d';

export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function chartIntervalSeconds(interval: ChartInterval): number {
  switch (interval) {
    case '1s':
      return 60; // Snapshot cadence: finest bucket is 1m; UI label 1s for parity with pro tools
    case '1m':
      return 60;
    case '3m':
      return 180;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '1h':
      return 3600;
    case '1d':
      return 86_400;
    case '5d':
      return 432_000;
    default:
      return 300;
  }
}

/** Live spot USD — TonAPI for TON jettons, DexScreener for Solana/EVM. */
export async function getLiveTokenSpotUsd(mint: string): Promise<number | null> {
  const kind = inferMintKind(mint);
  if (kind === 'ton') return fetchTonApiJettonUsdPrice(mint);
  if (kind === 'sol') return fetchDexScreenerSpotUsd(mint, 'sol');
  if (kind === 'evm') return fetchDexScreenerSpotUsd(mint, 'base') ?? fetchDexScreenerSpotUsd(mint, 'bnb');
  return null;
}

/** @deprecated Use {@link getLiveTokenSpotUsd}. */
export async function getLiveJettonSpotUsd(mint: string): Promise<number | null> {
  return getLiveTokenSpotUsd(mint);
}

export function aggregateSnapshotsToOhlc(
  rows: TokenMarketSnapshotRow[],
  intervalSec: number,
): OhlcBar[] {
  type Bucket = { open: number; high: number; low: number; close: number; tOpen: number; tClose: number };
  const buckets = new Map<number, Bucket>();

  for (const row of rows) {
    const px = row.price_usd;
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    const t = new Date(row.snapshot_at).getTime();
    if (Number.isNaN(t)) continue;
    const tsSec = Math.floor(t / 1000);
    const start = Math.floor(tsSec / intervalSec) * intervalSec;
    const existing = buckets.get(start);
    if (existing === undefined) {
      buckets.set(start, {
        open: px,
        high: px,
        low: px,
        close: px,
        tOpen: t,
        tClose: t,
      });
    } else {
      existing.high = Math.max(existing.high, px);
      existing.low = Math.min(existing.low, px);
      if (t >= existing.tClose) {
        existing.close = px;
        existing.tClose = t;
      }
      if (t <= existing.tOpen) {
        existing.open = px;
        existing.tOpen = t;
      }
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, b]) => ({
      time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
}

/** Append or extend the last candle with a live spot. */
export function mergeLiveSpot(bars: OhlcBar[], intervalSec: number, spotUsd: number | null): OhlcBar[] {
  if (spotUsd == null || !Number.isFinite(spotUsd) || spotUsd <= 0) return bars;
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / intervalSec) * intervalSec;
  const last = bars[bars.length - 1];
  if (last && last.time === bucket) {
    return [
      ...bars.slice(0, -1),
      {
        time: bucket,
        open: last.open,
        high: Math.max(last.high, spotUsd),
        low: Math.min(last.low, spotUsd),
        close: spotUsd,
      },
    ];
  }
  if (last) {
    return [
      ...bars,
      {
        time: bucket,
        open: spotUsd,
        high: spotUsd,
        low: spotUsd,
        close: spotUsd,
      },
    ];
  }
  return [
    {
      time: bucket,
      open: spotUsd,
      high: spotUsd,
      low: spotUsd,
      close: spotUsd,
    },
  ];
}

export async function getTokenChartBars(mint: string, interval: ChartInterval): Promise<OhlcBar[]> {
  const intervalSec = chartIntervalSeconds(interval);
  const spanDays =
    interval === '1d' || interval === '5d'
      ? 180
      : interval === '1h' || interval === '15m'
        ? 45
        : interval === '1m' || interval === '3m'
          ? 21
          : 14;
  const since = subDays(new Date(), spanDays).toISOString();
  const limit = interval === '1d' || interval === '5d' ? 8000 : 4000;
  const snaps = await listSnapshotsForMintRange(mint, since, limit);
  const fromDb = aggregateSnapshotsToOhlc(snaps, intervalSec);
  const spot = await getLiveTokenSpotUsd(mint);
  return mergeLiveSpot(fromDb, intervalSec, spot);
}
