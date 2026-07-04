import { NextResponse, type NextRequest } from 'next/server';
import {
  IxError,
  insightxConfigured,
  ixAtlasLatest,
  ixClusters,
  toIxNetwork,
  type IxNetwork,
} from '@/lib/insightx/client';
import { applyAtlasLabels, normalizeClusters } from '@/lib/insightx/normalize';
import { recognizedWalletFromRegistry } from '@/lib/identity/bridgeWalletIntel';
import type { AppChainId } from '@/lib/chains/appChain';
import type { BubbleMapData } from '@/lib/tokens/bubbleMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NETWORKS: IxNetwork[] = ['eth', 'sol', 'base', 'bsc', 'monad', 'xlayer', 'abs'];
const APP_CHAIN_BY_IX: Partial<Record<IxNetwork, AppChainId>> = {
  sol: 'sol',
  eth: 'eth',
  base: 'base',
  bsc: 'bnb',
};

/** Name cluster wallets that are known KOL/smart/whale via the identity registry. */
function applyRegistryNames(data: BubbleMapData, network: IxNetwork): BubbleMapData {
  const chain = APP_CHAIN_BY_IX[network];
  if (!chain) return data;
  return {
    links: data.links,
    nodes: data.nodes.map((n) => {
      const rec = recognizedWalletFromRegistry(chain, n.id);
      if (!rec) return n;
      return { ...n, label: rec.displayName, role: rec.category === 'kol' ? 'kol' : n.role };
    }),
  };
}

/**
 * Bubble-map graph for a token from InsightX. Primary source is the cluster
 * endpoint (coordinated wallet groups, sized by %, intra-cluster links
 * synthesized). Atlas is fetched best-effort to layer CEX/KOL labels onto nodes.
 *
 * Returns `{ configured:false }` cheaply when no key is set — no upstream call,
 * so opening the Bubbles tab never burns the free-tier quota until connected.
 * Heavily cached (client TTL + CDN s-maxage) to respect 1k req/month.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  if (!insightxConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const { mint } = await ctx.params;
  const netParam = req.nextUrl.searchParams.get('network');
  const network = (NETWORKS.includes(netParam as IxNetwork) ? netParam : toIxNetwork(netParam)) as
    | IxNetwork
    | null;
  if (!network) {
    return NextResponse.json({ configured: true, error: 'unsupported_network', nodes: [], links: [] });
  }

  try {
    const clusters = await ixClusters(network, mint);
    let data = normalizeClusters(clusters);

    // Best-effort label enrichment (CEX/KOL names) — never breaks the map.
    if (data.nodes.length > 0) {
      const atlas = await ixAtlasLatest(network, mint).catch(() => null);
      if (atlas) data = applyAtlasLabels(data, atlas);
      // Our CabalSpy/kolscan/axiom registry takes precedence for KOL names.
      data = applyRegistryNames(data, network);
    }

    return NextResponse.json(
      {
        configured: true,
        network,
        source: 'clusters',
        nodes: data.nodes,
        links: data.links,
        summary: {
          nodeCount: data.nodes.length,
          linkCount: data.links.length,
          clusterCount: clusters.clusters?.length ?? 0,
          clusteredPct: Math.round((clusters.total_cluster_pct ?? 0) * 100) / 100,
        },
      },
      { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    if (err instanceof IxError) {
      const status = err.code === 'rate_limited' ? 429 : 502;
      return NextResponse.json(
        { configured: true, error: err.code, message: err.message, nodes: [], links: [] },
        { status },
      );
    }
    return NextResponse.json(
      { configured: true, error: 'unknown', nodes: [], links: [] },
      { status: 500 },
    );
  }
}
