import 'server-only';

import { kalshiGetEvents, kalshiGetMarket, kalshiGetMarkets, kalshiGetTrades } from '@/lib/kalshi/client';
import { mapKalshiMarket, mapKalshiTrade } from '@/lib/kalshi/mapMarket';
import {
  filterPredictionMarkets,
  KALSHI_PREDICTION_MARKETS,
} from '@/lib/predictions/marketsDemo';
import { isCryptoPredictionMarket } from '@/lib/predictions/groupMarkets';
import type {
  PredictionDeskCategory,
  PredictionMarket,
  PredictionMarketsResponse,
  PredictionSort,
} from '@/lib/predictions/types';

export type FetchPredictionMarketsOpts = {
  deskCategory?: PredictionDeskCategory;
  tag?: string | null;
  query?: string;
  sort?: PredictionSort;
  limit?: number;
};

let cachedLive: { at: number; markets: PredictionMarket[] } | null = null;
const LIVE_CACHE_MS = 45_000;

function dedupeMarkets(rows: PredictionMarket[]): PredictionMarket[] {
  const seen = new Set<string>();
  const out: PredictionMarket[] = [];
  for (const m of rows) {
    const key = m.ticker ?? m.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function markFeatured(rows: PredictionMarket[]): PredictionMarket[] {
  const sorted = [...rows].sort((a, b) => b.volumeUsd - a.volumeUsd);
  const featuredIds = new Set(sorted.slice(0, 5).map((m) => m.id));
  return rows.map((m) => ({ ...m, featured: featuredIds.has(m.id) }));
}

function hasTradeablePrice(m: PredictionMarket): boolean {
  return m.yesPriceCents > 0.5 || m.noPriceCents > 0.5;
}

function eventLooksCrypto(title: string, category?: string): boolean {
  const s = `${category ?? ''} ${title}`.toLowerCase();
  return /crypto|bitcoin|btc|eth|ethereum|solana|\bsol\b|digital asset|blockchain|defi|token|etf/.test(s);
}

function mergeDemoSupplements(live: PredictionMarket[]): PredictionMarket[] {
  const liveKeys = new Set(live.map((m) => m.ticker ?? m.id));
  const demoExtra = KALSHI_PREDICTION_MARKETS.filter((d) => !liveKeys.has(d.ticker ?? d.id));
  if (demoExtra.length === 0) return live;
  return dedupeMarkets([...live, ...demoExtra]);
}

async function loadKalshiMarkets(limit = 200): Promise<PredictionMarket[]> {
  const now = Date.now();
  if (cachedLive && now - cachedLive.at < LIVE_CACHE_MS) {
    return cachedLive.markets;
  }

  try {
    const eventTitleByTicker = new Map<string, string>();
    const eventCategoryByTicker = new Map<string, string>();
    const markets: PredictionMarket[] = [];

    try {
      const eventsRes = await kalshiGetEvents({
        limit: 160,
        status: 'open',
        withNestedMarkets: true,
      });
      for (const ev of eventsRes.events) {
        const title = ev.title?.trim();
        const cat = ev.category?.trim();
        if (ev.event_ticker && title) {
          eventTitleByTicker.set(ev.event_ticker, title);
        }
        if (ev.event_ticker && cat) {
          eventCategoryByTicker.set(ev.event_ticker, cat);
        }
        for (const m of ev.markets ?? []) {
          if (m.event_ticker && title) {
            eventTitleByTicker.set(m.event_ticker, title);
          }
          if (m.event_ticker && cat) {
            eventCategoryByTicker.set(m.event_ticker, cat);
          }
          const mapped = mapKalshiMarket(m, title, cat);
          if (evLooksCrypto(title ?? '', cat)) {
            mapped.tags = [...new Set([...mapped.tags, 'Crypto'])];
            if (mapped.category === 'Politics') mapped.category = 'Crypto';
          }
          if (!hasTradeablePrice(mapped)) continue;
          markets.push(mapped);
        }
      }
    } catch {
      /* event titles optional */
    }

    const flat = await kalshiGetMarkets({
      limit: 200,
      status: 'open',
      mveFilter: 'exclude',
    });

    for (const m of flat.markets) {
      const eventTitle = m.event_ticker
        ? eventTitleByTicker.get(m.event_ticker)
        : undefined;
      const evCat = m.event_ticker ? eventCategoryByTicker.get(m.event_ticker) : undefined;
      const mapped = mapKalshiMarket(m, eventTitle, evCat);
      if (evCat) {
        mapped.tags = [...new Set([...mapped.tags, evCat])];
      }
      if (!hasTradeablePrice(mapped)) continue;
      markets.push(mapped);
    }

    let rows = dedupeMarkets(markets);
    rows.sort((a, b) => b.volumeUsd - a.volumeUsd);
    rows = markFeatured(rows.slice(0, limit));
    rows = mergeDemoSupplements(rows);

    if (rows.length > 0) {
      try {
        const trades = await kalshiGetTrades({ limit: 80 });
        const byTicker = new Map<string, ReturnType<typeof mapKalshiTrade>[]>();
        for (const t of trades.trades) {
          const row = mapKalshiTrade(t);
          const list = byTicker.get(t.ticker) ?? [];
          list.push(row);
          byTicker.set(t.ticker, list);
        }
        for (const m of rows) {
          const key = m.ticker ?? m.id;
          const recent = byTicker.get(key);
          if (recent?.length) m.recentTrades = recent.slice(0, 10);
        }
      } catch {
        /* trades optional */
      }
      cachedLive = { at: now, markets: rows };
      return rows;
    }
  } catch (err) {
    console.warn('[pointer][kalshi] markets fetch failed:', err instanceof Error ? err.message : err);
  }
  return [];
}

export async function fetchPredictionMarkets(
  opts: FetchPredictionMarketsOpts = {},
): Promise<PredictionMarketsResponse> {
  const live = await loadKalshiMarkets(opts.limit ?? 200);
  const sourceMarkets = live.length > 0 ? live : KALSHI_PREDICTION_MARKETS;

  const filtered = filterPredictionMarkets({
    markets: sourceMarkets,
    deskCategory: opts.deskCategory ?? 'Trending',
    tag: opts.tag ?? null,
    query: opts.query ?? '',
    sort: opts.sort ?? 'volume',
  });

  return {
    markets: filtered,
    cursor: null,
    source: live.length > 0 ? 'kalshi' : 'demo',
    live: live.length > 0,
  };
}

export async function getPredictionEventMarkets(id: string): Promise<PredictionMarket[]> {
  const pool = await loadKalshiMarkets(400);
  const decoded = decodeURIComponent(id);
  const byEvent = pool.filter((m) => m.eventTicker === decoded);
  if (byEvent.length > 0) {
    return [...byEvent].sort((a, b) => b.volumeUsd - a.volumeUsd);
  }

  const single = pool.find((m) => m.id === decoded || m.ticker === decoded);
  if (single) return [single];

  try {
    const fetched = await kalshiGetMarkets({
      eventTicker: decoded,
      status: 'open',
      limit: 200,
      mveFilter: 'exclude',
    });
    if (fetched.markets.length > 0) {
      return fetched.markets
        .map((m) => mapKalshiMarket(m))
        .filter(hasTradeablePrice)
        .sort((a, b) => b.volumeUsd - a.volumeUsd);
    }
  } catch {
    /* fall through */
  }

  const demo = KALSHI_PREDICTION_MARKETS.filter(
    (m) => m.eventTicker === decoded || m.id === decoded || m.ticker === decoded,
  );
  if (demo.length > 0) return demo;

  return [];
}

export async function getPredictionMarketById(id: string): Promise<PredictionMarket | null> {
  const decoded = decodeURIComponent(id);
  const outcomes = await getPredictionEventMarkets(decoded);
  if (outcomes.length > 0) return outcomes[0]!;

  try {
    const raw = await kalshiGetMarket(decoded);
    if (raw) {
      const mapped = mapKalshiMarket(raw);
      if (hasTradeablePrice(mapped)) return mapped;
    }
  } catch {
    /* ignore */
  }

  return KALSHI_PREDICTION_MARKETS.find((m) => m.id === decoded || m.ticker === decoded) ?? null;
}

export async function getPredictionMarketDetail(id: string): Promise<{
  market: PredictionMarket;
  outcomes: PredictionMarket[];
} | null> {
  const outcomes = await getPredictionEventMarkets(id);
  if (outcomes.length === 0) return null;
  return { market: outcomes[0]!, outcomes };
}
