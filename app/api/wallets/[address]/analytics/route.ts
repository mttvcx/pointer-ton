import { NextResponse, type NextRequest } from 'next/server';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getWalletStats } from '@/lib/db/wallets';
import { buildSolWalletAnalytics } from '@/lib/wallet-analytics/buildSolAnalytics';
import { buildTonWalletAnalytics } from '@/lib/wallet-analytics/buildTonAnalytics';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TF: WalletAnalyticsTimeframe[] = ['1d', '7d', '30d', 'max'];

function parseTf(raw: string | null): WalletAnalyticsTimeframe {
  if (raw && (TF as readonly string[]).includes(raw)) return raw as WalletAnalyticsTimeframe;
  return '30d';
}

/**
 * Public wallet intelligence snapshot (chain RPC + indexed stats).
 * Does not expose user-private portfolio FIFO — positions are holdings-based estimates.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await ctx.params;
  const address = raw.trim();
  const tf = parseTf(req.nextUrl.searchParams.get('tf'));

  const kind = inferMintKind(address);
  if (kind === 'unknown') {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  let statsAddr = address;
  if (kind === 'ton') {
    const c = normalizeTonAddress(address);
    if (!c) return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    statsAddr = c;
  } else if (kind === 'sol') {
    if (!isValidPublicKey(address)) {
      return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    statsAddr = address;
  } else {
    return NextResponse.json({ error: 'unsupported_chain' }, { status: 400 });
  }

  const stats = await getWalletStats(statsAddr).catch(() => null);

  try {
    if (kind === 'sol') {
      const payload = await buildSolWalletAnalytics({
        address,
        timeframe: tf,
        stats,
      });
      return NextResponse.json({ timeframe: tf, data: payload });
    }

    const payload = await buildTonWalletAnalytics({
      address,
      timeframe: tf,
      stats,
    });
    return NextResponse.json({ timeframe: tf, data: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'wallet_analytics_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
