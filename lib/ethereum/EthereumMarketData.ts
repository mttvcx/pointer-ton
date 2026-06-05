import type { AppChainId } from '@/lib/chains/appChain';
import { enrichPulseBundlesWithDexScreener } from '@/lib/market/dexscreenerPulse';
import type { PulseTokenBundle } from '@/types/tokens';

const ETH_CHAIN: AppChainId = 'eth';

/** DexScreener enrichment for Ethereum Pulse rows. */
export async function enrichEthereumPulseBundles(
  bundles: PulseTokenBundle[],
): Promise<PulseTokenBundle[]> {
  return enrichPulseBundlesWithDexScreener(bundles, ETH_CHAIN);
}
