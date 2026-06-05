import 'server-only';

import { ingestLaunchpadDiscovery } from '@/lib/helius/discoveryIngest';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { getTokenByMint, type TokenRow } from '@/lib/db/tokens';
import type { Json } from '@/lib/supabase/types';
import type { LaunchpadId } from '@/lib/utils/constants';

export type GeckoPulseNetwork = 'eth' | 'bsc' | 'base';

type GeckoTokenAttrs = {
  address?: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  image_url?: string | null;
};

type GeckoPoolRow = {
  attributes?: { name?: string | null };
  relationships?: {
    base_token?: { data?: { id?: string | null } | null };
    quote_token?: { data?: { id?: string | null } | null };
  };
};

type GeckoResponse = {
  data?: GeckoPoolRow[];
  included?: Array<{
    id?: string;
    type?: string;
    attributes?: GeckoTokenAttrs;
  }>;
};

export function normalizeEvmMint(addr: string): string | null {
  const a = addr.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return null;
  if (a === '0x0000000000000000000000000000000000000000') return null;
  return a;
}

type GeckoSingleTokenResponse = {
  data?: { attributes?: GeckoTokenAttrs };
};

/**
 * On-demand EVM token row from Gecko Terminal when opening `/token/0x…`.
 */
export async function ensureTokenRowFromGeckoEvm(mintParam: string): Promise<TokenRow | null> {
  const mint = normalizeEvmMint(mintParam);
  if (!mint) return null;

  const existing = await getTokenByMint(mint);
  if (existing) return existing;

  for (const network of ['eth', 'bsc', 'base'] as const) {
    const u = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${encodeURIComponent(mint)}`;
    const res = await fetch(u, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) continue;

    const json = (await res.json()) as GeckoSingleTokenResponse;
    const attrs = json.data?.attributes;
    if (!attrs?.address && !attrs?.symbol && !attrs?.name) continue;

    const symbol = attrs.symbol?.trim() || null;
    const name = attrs.name?.trim() || null;
    const image_url = attrs.image_url ?? null;
    const decimals =
      typeof attrs.decimals === 'number' && Number.isFinite(attrs.decimals) ? attrs.decimals : 18;

    const raw = {
      geckoNetwork: network,
      geckoHydrate: true,
      geckoToken: attrs ?? {},
    } as unknown as Json;

    const ev: LaunchpadEvent = {
      launchpad: launchpadForNetwork(network),
      mint,
      creator_wallet: null,
      symbol,
      name,
      image_url,
      initial_liquidity_sol: null,
      bonding_progress: null,
      raw,
    };
    await ingestLaunchpadDiscovery(ev, { alertSource: 'gecko_terminal' });
    return getTokenByMint(mint);
  }

  return null;
}

function launchpadForNetwork(n: GeckoPulseNetwork): LaunchpadId {
  if (n === 'eth') return 'eth';
  if (n === 'bsc') return 'bsc';
  return 'base';
}

/**
 * Ingest latest new pools from Gecko Terminal (BNB Chain + Base) into `tokens`
 * so Pulse can filter EVM mints for `bnb` / `base` app chains.
 */
export async function pollGeckoNewPools(network: GeckoPulseNetwork): Promise<number> {
  const u = new URL(`https://api.geckoterminal.com/api/v2/networks/${network}/new_pools`);
  u.searchParams.set('page', '1');
  u.searchParams.set('include', 'base_token,quote_token');

  const res = await fetch(u.toString(), {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`gecko_new_pools ${res.status}`);
  }

  const json = (await res.json()) as GeckoResponse;
  const byId = new Map<string, GeckoTokenAttrs>();
  for (const row of json.included ?? []) {
    if (row.type !== 'token' || !row.id || !row.attributes) continue;
    byId.set(row.id, row.attributes);
  }

  let inserted = 0;
  const seen = new Set<string>();
  const pad = launchpadForNetwork(network);

  for (const pool of json.data ?? []) {
    const baseId = pool.relationships?.base_token?.data?.id;
    if (!baseId) continue;
    const attrs = byId.get(baseId);
    const quoteId = pool.relationships?.quote_token?.data?.id;
    const quoteAttrs = quoteId ? byId.get(quoteId) : undefined;
    const quoteSymbol = quoteAttrs?.symbol?.trim().toUpperCase() ?? null;
    const quoteMint = quoteAttrs?.address?.trim() ?? null;
    const fromAttrs = attrs?.address?.trim() ?? '';
    const mintRaw = fromAttrs
      ? fromAttrs
      : baseId.startsWith(`${network}_`)
        ? baseId.slice(network.length + 1)
        : baseId;
    const mint = normalizeEvmMint(mintRaw);
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);

    const symbol = attrs?.symbol?.trim() || null;
    const poolName = pool.attributes?.name?.split('/')?.[0]?.trim() ?? null;
    const name = attrs?.name?.trim() || poolName;
    const image_url = attrs?.image_url ?? null;
    const decimals =
      typeof attrs?.decimals === 'number' && Number.isFinite(attrs.decimals)
        ? attrs.decimals
        : 18;

    const raw = {
      geckoNetwork: network,
      decimals,
      geckoPool: pool,
      geckoToken: attrs ?? {},
      geckoQuoteToken: quoteAttrs ?? null,
      quoteSymbol,
      quoteMint,
      geckoQuoteSymbol: quoteSymbol,
    } as unknown as Json;

    const ev: LaunchpadEvent = {
      launchpad: pad,
      mint,
      creator_wallet: null,
      symbol,
      name,
      image_url,
      initial_liquidity_sol: null,
      bonding_progress: null,
      raw,
    };
    inserted += await ingestLaunchpadDiscovery(ev, { alertSource: 'gecko_terminal' });
  }

  return inserted;
}
