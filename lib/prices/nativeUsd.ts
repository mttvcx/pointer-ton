import 'server-only';

import type { EvmTradeChain } from '@/lib/evm/evmTradeChains';

/**
 * Native-token USD price for EVM trade chains — used to normalize EVM trade
 * volume into a SOL-equivalent so points/quests are FAIR across chains (1 ETH of
 * volume ≈ 15 SOL, not 1). CoinGecko public spot, cached, with a sane fallback so
 * we never credit zero or block a trade record on a price hiccup.
 */

const CG_ID: Record<EvmTradeChain, 'ethereum' | 'binancecoin'> = {
  eth: 'ethereum',
  base: 'ethereum',
  bnb: 'binancecoin',
};

const FALLBACK_USD: Record<'ethereum' | 'binancecoin', number> = {
  ethereum: 3200,
  binancecoin: 650,
};

export async function getNativeUsdForEvmChain(chain: EvmTradeChain): Promise<number> {
  const id = CG_ID[chain];
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return FALLBACK_USD[id];
    const json = (await res.json()) as Record<string, { usd?: number }>;
    const p = Number(json?.[id]?.usd);
    return Number.isFinite(p) && p > 0 ? p : FALLBACK_USD[id];
  } catch {
    return FALLBACK_USD[id];
  }
}
