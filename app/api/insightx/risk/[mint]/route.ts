import { NextResponse, type NextRequest } from 'next/server';
import { IxError, insightxConfigured, toIxNetwork, type IxNetwork } from '@/lib/insightx/client';
import { analyzeBubbleRisk } from '@/lib/ai/pipelines/bubbleRisk';
import { QuotaError } from '@/lib/ai/quota';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NETWORKS: IxNetwork[] = ['eth', 'sol', 'base', 'bsc', 'monad', 'xlayer', 'abs'];

/**
 * AI risk read of a token's holder bubble map. Authenticated (cascade bills the
 * user's AI quota + awards points) and key-gated on InsightX. The verdict is
 * cached per mint/network by the cascade, so repeat opens don't re-bill.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  if (!insightxConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let userId: string | null = null;
  try {
    const verified = await verifyPrivyAccessToken(token);
    const user = await getUserByPrivyId(verified.privyId);
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { mint } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { network?: string; mode?: string };
  const netRaw = body.network;
  const network = (NETWORKS.includes(netRaw as IxNetwork) ? netRaw : toIxNetwork(netRaw)) as
    | IxNetwork
    | null;
  if (!network) {
    return NextResponse.json({ configured: true, error: 'unsupported_network' }, { status: 400 });
  }

  try {
    const r = await analyzeBubbleRisk({
      mint,
      userId,
      network,
      mode: body.mode === 'deep' ? 'deep' : 'fast',
    });
    return NextResponse.json({
      configured: true,
      risk: r.data,
      modelUsed: r.modelUsed,
      cached: r.cacheHit,
    });
  } catch (err) {
    if (err instanceof QuotaError) {
      return NextResponse.json({ configured: true, error: 'quota', message: err.message }, { status: 429 });
    }
    if (err instanceof IxError && err.code === 'rate_limited') {
      return NextResponse.json({ configured: true, error: 'rate_limited' }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : 'analyze_failed';
    return NextResponse.json({ configured: true, error: 'analyze_failed', message }, { status: 500 });
  }
}
