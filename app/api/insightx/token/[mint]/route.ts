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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NETWORKS: IxNetwork[] = ['eth', 'sol', 'base', 'bsc', 'monad', 'xlayer', 'abs'];

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
