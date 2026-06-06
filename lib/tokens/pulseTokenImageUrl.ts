import type { AppChainId } from '@/lib/chains/appChain';
import { dexScreenerTokenIconUrl } from '@/lib/explore/demoTokenIcons';
import type { PulseTokenBundle } from '@/types/tokens';

/** Same image resolution as `PulseTokenAvatar` — DB url, then DexScreener fallback. */
export function resolvePulseTokenImageUrl(
  bundle: PulseTokenBundle,
  chain: AppChainId,
): string | null {
  const fromDb = bundle.token.image_url?.trim();
  if (fromDb) return fromDb;
  const dex = dexScreenerTokenIconUrl(chain, bundle.token.mint);
  return dex?.trim() || null;
}
