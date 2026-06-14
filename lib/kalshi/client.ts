import 'server-only';

import { kalshiSignRequest } from '@/lib/kalshi/sign';
import {
  KalshiEventsResponseSchema,
  KalshiMarketsResponseSchema,
  KalshiTradesResponseSchema,
  type CreateOrderBody,
} from '@/lib/kalshi/schemas';

const DEFAULT_BASE =
  process.env.KALSHI_API_BASE?.trim() ||
  'https://api.elections.kalshi.com/trade-api/v2';

function apiRoot(): string {
  return DEFAULT_BASE.replace(/\/$/, '');
}

function signPath(fullPath: string): string {
  const u = new URL(fullPath, 'https://kalshi.local');
  return u.pathname;
}

function hasKalshiAuth(): boolean {
  return Boolean(
    process.env.KALSHI_API_KEY_ID?.trim() && process.env.KALSHI_PRIVATE_KEY?.trim(),
  );
}

function authHeaders(method: string, pathForSign: string): Record<string, string> {
  const keyId = process.env.KALSHI_API_KEY_ID?.trim();
  let pem = process.env.KALSHI_PRIVATE_KEY?.trim() ?? '';
  if (!keyId || !pem) return {};
  pem = pem.replace(/\\n/g, '\n');
  const ts = Date.now();
  const sig = kalshiSignRequest({
    privateKeyPem: pem,
    timestampMs: ts,
    method,
    path: pathForSign,
  });
  return {
    'KALSHI-ACCESS-KEY': keyId,
    'KALSHI-ACCESS-TIMESTAMP': String(ts),
    'KALSHI-ACCESS-SIGNATURE': sig,
  };
}

async function kalshiFetch<T>(
  path: string,
  opts?: { method?: string; body?: unknown; auth?: boolean },
): Promise<T> {
  const method = opts?.method ?? 'GET';
  const url = `${apiRoot()}${path.startsWith('/') ? path : `/${path}`}`;
  const signOnlyPath = signPath(`/trade-api/v2${path.split('?')[0]}`);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts?.auth ? authHeaders(method, signOnlyPath) : {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`kalshi_${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

export function kalshiConfigured(): boolean {
  return hasKalshiAuth();
}

export async function kalshiGetMarkets(params?: {
  limit?: number;
  cursor?: string;
  status?: string;
  seriesTicker?: string;
  eventTicker?: string;
  mveFilter?: 'exclude' | 'only';
}) {
  const q = new URLSearchParams();
  q.set('limit', String(Math.min(200, params?.limit ?? 100)));
  if (params?.cursor) q.set('cursor', params.cursor);
  if (params?.status) q.set('status', params.status);
  if (params?.seriesTicker) q.set('series_ticker', params.seriesTicker);
  if (params?.eventTicker) q.set('event_ticker', params.eventTicker);
  if (params?.mveFilter) q.set('mve_filter', params.mveFilter);
  const json = await kalshiFetch<unknown>(`/markets?${q.toString()}`);
  return KalshiMarketsResponseSchema.parse(json);
}

export async function kalshiGetMarket(ticker: string) {
  const json = await kalshiFetch<{ market?: unknown }>(
    `/markets/${encodeURIComponent(ticker)}`,
  );
  const parsed = KalshiMarketsResponseSchema.safeParse({
    markets: json.market ? [json.market] : [],
  });
  return parsed.success ? parsed.data.markets[0] ?? null : null;
}

export async function kalshiGetEvents(params?: {
  limit?: number;
  cursor?: string;
  status?: string;
  withNestedMarkets?: boolean;
}) {
  const q = new URLSearchParams();
  q.set('limit', String(Math.min(200, params?.limit ?? 80)));
  if (params?.cursor) q.set('cursor', params.cursor);
  if (params?.status) q.set('status', params.status);
  if (params?.withNestedMarkets) q.set('with_nested_markets', 'true');
  const json = await kalshiFetch<unknown>(`/events?${q.toString()}`);
  return KalshiEventsResponseSchema.parse(json);
}

export async function kalshiGetTrades(params?: {
  limit?: number;
  cursor?: string;
  ticker?: string;
}) {
  const q = new URLSearchParams();
  q.set('limit', String(Math.min(100, params?.limit ?? 40)));
  if (params?.cursor) q.set('cursor', params.cursor);
  if (params?.ticker) q.set('ticker', params.ticker);
  const json = await kalshiFetch<unknown>(`/markets/trades?${q.toString()}`);
  return KalshiTradesResponseSchema.parse(json);
}

export async function kalshiCreateOrder(body: CreateOrderBody) {
  if (!hasKalshiAuth()) {
    throw new Error('kalshi_auth_missing');
  }
  const priceField =
    body.side === 'yes'
      ? { yes_price: body.yes_price ?? 50 }
      : { no_price: body.no_price ?? 50 };

  const payload = {
    ticker: body.ticker,
    action: body.action,
    side: body.side,
    count: body.count,
    type: body.type,
    ...priceField,
  };
  return kalshiFetch<unknown>('/portfolio/orders', {
    method: 'POST',
    body: payload,
    auth: true,
  });
}

export async function kalshiGetPositions() {
  if (!hasKalshiAuth()) return { market_positions: [] as unknown[] };
  return kalshiFetch<{ market_positions?: unknown[] }>('/portfolio/positions', {
    auth: true,
  });
}
