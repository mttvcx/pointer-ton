import 'server-only';

import type { PackReward } from '@/types/pack';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getPackTokenById } from '@/lib/packs/packTokens';

const DEFAULT_SOL_USD = 165;

async function fetchSolUsd(): Promise<number> {
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_SOL_USD;
    const json = (await res.json()) as {
      data?: Record<string, { price?: string }>;
    };
    const p = Number(json.data?.So11111111111111111111111111111111111111112?.price);
    return Number.isFinite(p) && p > 0 ? p : DEFAULT_SOL_USD;
  } catch {
    return DEFAULT_SOL_USD;
  }
}

async function liveTokenQuote(mint: string, fallback: { priceUsd: number; mcUsd: number }) {
  try {
    const snap = await getLatestSnapshotForMint(mint);
    const priceUsd =
      snap?.price_usd != null && Number.isFinite(snap.price_usd) ? snap.price_usd : fallback.priceUsd;
    const marketCapUsd =
      snap?.market_cap_usd != null && Number.isFinite(snap.market_cap_usd)
        ? snap.market_cap_usd
        : fallback.mcUsd;
    return { priceUsd, marketCapUsd };
  } catch {
    return { priceUsd: fallback.priceUsd, marketCapUsd: fallback.mcUsd };
  }
}

export async function enrichPackRewards(rewards: PackReward[]): Promise<PackReward[]> {
  const solUsd = await fetchSolUsd();
  const out: PackReward[] = [];

  for (const r of rewards) {
    if (r.kind !== 'token_reward' && r.kind !== 'legendary_reward') {
      out.push(r);
      continue;
    }

    const def = r.tokenId ? getPackTokenById(r.tokenId) : null;
    const mint = r.tokenMint ?? def?.mint;
    if (!mint || !def) {
      out.push(r);
      continue;
    }

    const live = await liveTokenQuote(mint, {
      priceUsd: def.fallbackPriceUsd,
      mcUsd: def.fallbackMarketCapUsd,
    });

    const valueUsd = (r.valueSol ?? 0) * solUsd;
    const amountTokens = live.priceUsd > 0 ? valueUsd / live.priceUsd : 0;

    out.push({
      ...r,
      tokenMint: mint,
      tokenSymbol: def.symbol,
      tokenName: def.name,
      tokenIconUrl: def.iconUrl,
      tokenPriceUsd: live.priceUsd,
      marketCapUsd: live.marketCapUsd,
      amountTokens,
      valueUsd,
      displayValue: `$${valueUsd.toFixed(2)}`,
    });
  }

  return out;
}
