import { NextResponse, type NextRequest } from 'next/server';
import {
  IxError,
  insightxConfigured,
  ixAtlasLatest,
  ixClusters,
  toIxNetwork,
  type IxNetwork,
} from '@/lib/insightx/client';
import { bubbleFromInsightx } from '@/lib/insightx/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NETWORKS: IxNetwork[] = ['eth', 'sol', 'base', 'bsc', 'monad', 'xlayer', 'abs'];

/**
 * Bubble-map graph for a token from InsightX (Atlas holder graph, cluster
 * fallback). Returns `{ configured:false }` cheaply when no key is set — no
 * upstream call, so opening the Bubbles tab never burns the free-tier quota
 * until a key is connected. Heavily cached (client TTL + CDN s-maxage).
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
    // Atlas first (has relationship links). Cluster fallback only if Atlas is empty.
    const atlas = await ixAtlasLatest(network, mint).catch(() => null);
    let clusters: unknown = null;
    let data = bubbleFromInsightx(atlas, null);
    if (data.nodes.length === 0) {
      clusters = await ixClusters(network, mint).catch(() => null);
      data = bubbleFromInsightx(atlas, clusters);
    }

    const flaggedPct = data.nodes
      .filter((n) => n.role && n.role !== 'lp')
      .reduce((s, n) => s + (n.pct || 0), 0);

    return NextResponse.json(
      {
        configured: true,
        network,
        source: atlas ? 'atlas' : clusters ? 'clusters' : 'none',
        nodes: data.nodes,
        links: data.links,
        summary: {
          nodeCount: data.nodes.length,
          linkCount: data.links.length,
          flaggedPct: Math.round(flaggedPct * 100) / 100,
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
