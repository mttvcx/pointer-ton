import 'server-only';

import { normalizeTonAddress } from '@/lib/utils/tonAddress';

/**
 * TonAPI (REST v2) — jetton catalog, metadata, and display rates.
 *
 * @see https://docs.tonconsole.com/tonapi/rest-api
 */
const TON_API_BASE =
  process.env.TON_API_BASE_URL?.replace(/\/$/, '') ?? 'https://tonapi.io';

const TON_API_KEY = process.env.TON_API_KEY?.trim();

function tonApiHeaders(): HeadersInit {
  const h: Record<string, string> = { accept: 'application/json' };
  if (TON_API_KEY) h.authorization = `Bearer ${TON_API_KEY}`;
  return h;
}

/** Subset of `JettonInfo` / `JettonMetadata` we persist and show in Pulse. */
export type TonApiJetton = {
  metadata?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: string;
    image?: string;
    description?: string;
    social?: string[];
    websites?: string[];
  };
  preview?: string;
  verification?: string;
  admin?: { address?: string };
  holders_count?: number;
  total_supply?: string;
  last_transaction_lt?: string;
  mintable?: boolean;
};

type JettonsListResponse = { jettons?: TonApiJetton[] };

export async function listTonApiJettons(opts: {
  limit: number;
  offset: number;
}): Promise<JettonsListResponse> {
  const u = new URL(`${TON_API_BASE}/v2/jettons`);
  u.searchParams.set('limit', String(Math.min(1000, Math.max(1, opts.limit))));
  u.searchParams.set('offset', String(Math.max(0, opts.offset)));

  const res = await fetch(u, { headers: tonApiHeaders(), next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`tonapi_jettons_list ${res.status}`);
  }
  return (await res.json()) as JettonsListResponse;
}

export async function fetchTonApiJettonByMaster(master: string): Promise<TonApiJetton | null> {
  const canon = normalizeTonAddress(master);
  if (!canon) return null;
  const enc = encodeURIComponent(canon);
  const res = await fetch(`${TON_API_BASE}/v2/jettons/${enc}`, {
    headers: tonApiHeaders(),
    next: { revalidate: 120 },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`tonapi_jetton ${res.status}`);
  }
  return (await res.json()) as TonApiJetton;
}

/**
 * Display-only USD price per jetton (TonAPI `/v2/rates`). Not for settlement.
 */
export async function fetchTonApiJettonUsdPrice(master: string): Promise<number | null> {
  const canon = normalizeTonAddress(master);
  if (!canon) return null;

  const u = new URL(`${TON_API_BASE}/v2/rates`);
  u.searchParams.set('tokens', canon);
  u.searchParams.set('currencies', 'usd');

  const res = await fetch(u, { headers: tonApiHeaders(), next: { revalidate: 30 } });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    rates?: Record<string, { prices?: Record<string, number> }>;
  } | null;
  const entry = json?.rates?.[canon] ?? json?.rates?.[master];
  const prices = entry?.prices;
  if (!prices) return null;
  const raw =
    prices.usd ??
    prices.USD ??
    prices['usd'] ??
    Object.values(prices).find((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}
