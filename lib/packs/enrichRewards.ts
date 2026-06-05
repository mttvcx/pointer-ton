import 'server-only';

import type { PackReward } from '@/types/pack';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getSolUsdPrice } from '@/lib/packs/pricing';
import { getPackTokenById } from '@/lib/packs/packTokens';

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

export async function enrichPackRewards(
  rewards: PackReward[],
  solUsdOverride?: number,
): Promise<PackReward[]> {
  const solUsd =
    solUsdOverride != null && solUsdOverride > 0
      ? solUsdOverride
      : (await getSolUsdPrice()).solUsd;
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
