import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { AppChainId } from '@/lib/chains/appChain';
import { isAppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { evmAddressesMatch } from '@/lib/chains/evmAddress';
import { isValidGlobalSearchQuery } from '@/lib/ethereum/EthereumSearch';
import type { DexPairRow } from '@/lib/market/dexscreenerPulse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAIN_PATH: Partial<Record<AppChainId, string>> = {
  sol: 'solana',
  eth: 'ethereum',
  bnb: 'bsc',
  base: 'base',
};

const Query = z
  .object({
    q: z.string().trim().min(32).max(120),
    chain: z.string().optional(),
  })
  .strict();

/** Live token preview for command palette (DexScreener only — no Helius). */
export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({
    q: req.nextUrl.searchParams.get('q'),
    chain: req.nextUrl.searchParams.get('chain') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ token: null });
  }

  const activeChain: AppChainId =
    parsed.data.chain && isAppChainId(parsed.data.chain) ? parsed.data.chain : 'sol';
  const q = parsed.data.q;

  if (!isValidGlobalSearchQuery(q) || !mintMatchesAppChain(q, activeChain)) {
    return NextResponse.json({ token: null });
  }

  const chainPath = CHAIN_PATH[activeChain];
  if (!chainPath) return NextResponse.json({ token: null });

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(q)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return NextResponse.json({ token: null });
    const json = (await res.json()) as { pairs?: DexPairRow[] };
    const pairs = (json.pairs ?? []).filter((p) => {
      const base = p.baseToken?.address?.trim();
      if (!base) return false;
      return evmAddressesMatch(base, q) || base === q;
    });
    if (pairs.length === 0) return NextResponse.json({ token: null });
    const best = [...pairs].sort(
      (a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0),
    )[0]!;
    const base = best.baseToken!;
    return NextResponse.json({
      token: {
        mint: q,
        symbol: base.symbol?.trim() ?? null,
        name: base.name?.trim() ?? null,
        image_url:
          best.info?.imageUrl?.trim() ||
          `https://dd.dexscreener.com/ds-data/tokens/${chainPath}/${q}.png`,
        market_cap_usd: best.marketCap ?? best.fdv ?? null,
        liquidity_usd:
          best.liquidity?.usd != null && Number.isFinite(Number(best.liquidity.usd))
            ? Number(best.liquidity.usd)
            : null,
        volume_24h_usd:
          best.volume?.h24 != null && Number.isFinite(Number(best.volume.h24))
            ? Number(best.volume.h24)
            : null,
        price_usd: best.priceUsd != null ? Number(best.priceUsd) : null,
      },
    });
  } catch {
    return NextResponse.json({ token: null });
  }
}
