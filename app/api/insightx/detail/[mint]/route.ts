import { NextResponse, type NextRequest } from 'next/server';
import {
  IxError,
  insightxConfigured,
  ixBundlers,
  ixInsiders,
  ixScan,
  ixSnipers,
  toIxNetwork,
  type IxFlaggedWallet,
  type IxNetwork,
} from '@/lib/insightx/client';
import { recognizedWalletFromRegistry } from '@/lib/identity/bridgeWalletIntel';
import type { AppChainId } from '@/lib/chains/appChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NETWORKS: IxNetwork[] = ['eth', 'sol', 'base', 'bsc', 'monad', 'xlayer', 'abs'];
const APP_CHAIN_BY_IX: Partial<Record<IxNetwork, AppChainId>> = {
  sol: 'sol',
  eth: 'eth',
  base: 'base',
  bsc: 'bnb',
};

const round = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;

/** Flagged-wallet list → display rows, named via the identity registry. */
function flagged(wallets: IxFlaggedWallet[] | undefined, chain: AppChainId | undefined) {
  return (wallets ?? [])
    .filter((w) => w && w.address)
    .slice(0, 100)
    .map((w) => {
      const rec = chain ? recognizedWalletFromRegistry(chain, String(w.address)) : null;
      return {
        address: String(w.address),
        name: rec?.displayName ?? null,
        percentage: round(w.percentage) ?? 0,
        reasons: Array.isArray(w.reasons) ? w.reasons.filter(Boolean).slice(0, 4) : [],
      };
    });
}

/**
 * Combined InsightX detail for a token — bundlers, snipers, insiders (DEX
 * Metrics) and the security scan, in one heavily-cached call so the Bundlers /
 * Snipers / Insiders / Security tabs share a single fetch. Returns
 * `{ configured:false }` cheaply when no key is set.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  if (!insightxConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const { mint } = await ctx.params;
  const netRaw = req.nextUrl.searchParams.get('network');
  const network = (NETWORKS.includes(netRaw as IxNetwork) ? netRaw : toIxNetwork(netRaw)) as
    | IxNetwork
    | null;
  if (!network) {
    return NextResponse.json({ configured: true, error: 'unsupported_network' });
  }
  const chain = APP_CHAIN_BY_IX[network];

  try {
    const [bundlers, snipers, insiders, scan] = await Promise.all([
      ixBundlers(network, mint).catch(() => null),
      ixSnipers(network, mint).catch(() => null),
      ixInsiders(network, mint).catch(() => null),
      ixScan(network, mint).catch(() => null),
    ]);

    const simple = (scan as { results?: { simple?: Record<string, unknown> } } | null)?.results
      ?.simple;
    const scanner = simple
      ? {
          score: round(simple.score) ?? (typeof simple.score === 'number' ? simple.score : null),
          message: typeof simple.message === 'string' ? simple.message : null,
          reasons: Array.isArray(simple.reasons) ? simple.reasons.filter(Boolean).slice(0, 8) : [],
        }
      : null;

    return NextResponse.json(
      {
        configured: true,
        network,
        bundlers: { totalPct: round(bundlers?.total_bundlers_pct), wallets: flagged(bundlers?.bundlers, chain) },
        snipers: { totalPct: round(snipers?.total_snipers_pct), wallets: flagged(snipers?.snipers, chain) },
        insiders: { totalPct: round(insiders?.total_insiders_pct), wallets: flagged(insiders?.insiders, chain) },
        scanner,
      },
      { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    if (err instanceof IxError) {
      const status = err.code === 'rate_limited' ? 429 : 502;
      return NextResponse.json({ configured: true, error: err.code }, { status });
    }
    return NextResponse.json({ configured: true, error: 'detail_failed' }, { status: 500 });
  }
}
