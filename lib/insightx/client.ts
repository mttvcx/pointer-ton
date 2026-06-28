import 'server-only';

/**
 * InsightX REST client — the data backbone for bubble maps, bundle/sniper
 * detection and wallet labels. Free tier is 5 req/min · 1,000 req/month, so
 * every call is cached in-process with a generous TTL and routes layer CDN
 * caching on top. The key is server-only (never NEXT_PUBLIC) and never leaves
 * this module.
 *
 * Base: https://api.insightx.network · Auth: header `X-API-Key`.
 */

const BASE = 'https://api.insightx.network';

export type IxNetwork = 'eth' | 'sol' | 'base' | 'bsc' | 'monad' | 'xlayer' | 'abs';

export function insightxConfigured(): boolean {
  return Boolean(process.env.INSIGHTX_API_KEY);
}

/** Map an app chain id to an InsightX network, or null when unsupported (e.g. ton). */
export function toIxNetwork(chain: string | null | undefined): IxNetwork | null {
  switch (chain) {
    case 'sol':
      return 'sol';
    case 'eth':
      return 'eth';
    case 'base':
      return 'base';
    case 'bnb':
      return 'bsc';
    default:
      return null;
  }
}

export class IxError extends Error {
  constructor(
    public code: 'not_configured' | 'rate_limited' | 'upstream',
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'IxError';
  }
}

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function ixFetch<T>(path: string, ttlMs: number): Promise<T> {
  const key = process.env.INSIGHTX_API_KEY;
  if (!key) throw new IxError('not_configured', 'INSIGHTX_API_KEY is not set', 0);

  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'X-API-Key': key, accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (err) {
    throw new IxError('upstream', err instanceof Error ? err.message : 'network_error', 0);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 429) throw new IxError('rate_limited', body || 'rate limited', 429);
    throw new IxError('upstream', body || res.statusText, res.status);
  }

  const json = (await res.json()) as T;
  cache.set(path, { at: Date.now(), value: json });
  return json;
}

const enc = encodeURIComponent;

// ── Labels ────────────────────────────────────────────────────────────────
export type IxLabel = {
  address: string;
  label: string;
  tags?: string[];
  smart_contract: boolean;
};

/** Batch address → label (≤100 addresses per call). Cached 24h. */
export function ixLabels(network: IxNetwork, addresses: string[]): Promise<IxLabel[]> {
  const list = addresses.slice(0, 100).map(enc).join(',');
  return ixFetch<IxLabel[]>(`/labels/v1/${network}/${list}`, 24 * 60 * 60 * 1000);
}

// ── DEX Metrics: bundlers / snipers / insiders ──────────────────────────────
export type IxFlaggedWallet = {
  address: string;
  balance?: number;
  percentage?: number;
  reasons?: string[] | null;
  slot?: number | null;
};
export type IxBundlersResp = { total_bundlers_pct?: number; bundlers?: IxFlaggedWallet[] };
export type IxSnipersResp = { total_snipers_pct?: number; snipers?: IxFlaggedWallet[] };
export type IxInsidersResp = { total_insiders_pct?: number; insiders?: IxFlaggedWallet[] };

export function ixBundlers(network: IxNetwork, token: string): Promise<IxBundlersResp> {
  return ixFetch(`/dex-metrics/v1/${network}/${enc(token)}/bundlers`, 15 * 60 * 1000);
}
export function ixSnipers(network: IxNetwork, token: string): Promise<IxSnipersResp> {
  return ixFetch(`/dex-metrics/v1/${network}/${enc(token)}/snipers`, 15 * 60 * 1000);
}
export function ixInsiders(network: IxNetwork, token: string): Promise<IxInsidersResp> {
  return ixFetch(`/dex-metrics/v1/${network}/${enc(token)}/insiders`, 15 * 60 * 1000);
}

// ── Clusters (coordinated wallet groups) ────────────────────────────────────
// Verified shape from a live key: each cluster carries its own pct + tags and a
// `cluster_addresses` list (member address/balance/percentage/tags). No explicit
// edges — intra-cluster links are synthesized in normalize.ts.
export type IxClusterMember = {
  address: string;
  balance?: number;
  percentage?: number;
  tags?: string[];
};
export type IxCluster = { pct?: number; tags?: string[]; cluster_addresses?: IxClusterMember[] };
export type IxClustersResp = { total_cluster_pct?: number; clusters?: IxCluster[] };

export function ixClusters(network: IxNetwork, token: string): Promise<IxClustersResp> {
  return ixFetch(`/dex-metrics/v1/${network}/${enc(token)}/clusters`, 15 * 60 * 1000);
}

// ── Atlas (holder graph: labels + relationship edges) ───────────────────────
// Verified: { snapshot, token, network, holders:[{id,address,label,tags}], ... }.
// Used to layer CEX/KOL labels + edges onto the cluster map. Normalized
// defensively (link field names not yet confirmed).
export function ixAtlasLatest(network: IxNetwork, token: string): Promise<unknown> {
  return ixFetch(`/atlas/v1/${network}/${enc(token)}/snapshots/latest`, 15 * 60 * 1000);
}

// ── Scanner (token security) ────────────────────────────────────────────────
export function ixScan(network: IxNetwork, token: string): Promise<unknown> {
  return ixFetch(`/scanner/v1/tokens/${network}/${enc(token)}`, 30 * 60 * 1000);
}
