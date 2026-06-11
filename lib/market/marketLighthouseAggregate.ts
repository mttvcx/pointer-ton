import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { tokenMatchesAppChain } from '@/lib/chains/evmTokenChain';
import { bundlePulseTokens, listRecentTokens } from '@/lib/db/tokens';
import { aggregateMarketLighthouseFromBundles } from '@/lib/market/marketLighthouseAggregateCore';
import type { LighthouseTf, MarketLighthouseSnapshot } from '@/lib/market/marketLighthouseSnapshot';

const SCAN_DEPTH = 4000;

export { aggregateMarketLighthouseFromBundles } from '@/lib/market/marketLighthouseAggregateCore';

export async function fetchMarketLighthouseSnapshot(
  chain: AppChainId,
  tf: LighthouseTf,
): Promise<MarketLighthouseSnapshot> {
  const tokens = await listRecentTokens(SCAN_DEPTH);
  const chainTokens = tokens.filter((t) => tokenMatchesAppChain(t, chain));
  const bundles = await bundlePulseTokens(chainTokens);
  return aggregateMarketLighthouseFromBundles(bundles, chain, tf);
}
