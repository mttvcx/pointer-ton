import type { AppChainId } from '@/lib/chains/appChain';
import { isSupportedFilterId, protocolIdToFilterId } from '@/lib/protocol/registry';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '@/lib/protocol/types';
import {
  extractDexIdFromBundle,
  protocolBrandIdFromDexId,
  resolveLaunchpadProtocolFromBundle,
} from '@/lib/tokens/launchpadAvatarChrome';
import { launchPadToProtocolId } from '@/lib/tokens/protocolBrand';
import type { PulseTokenBundle } from '@/types/tokens';

export function filterIdsFromTokenRow(token: {
  protocol_id?: string | null;
  source_confidence?: number | null;
}): string[] {
  const conf = token.source_confidence ?? 0;
  if (!token.protocol_id || conf < PROTOCOL_FILTER_MIN_CONFIDENCE) return [];
  const filterId = protocolIdToFilterId(token.protocol_id);
  return filterId ? [filterId] : [];
}

/** Pulse column protocol filter — DB classification + launch_pad + dex + metadata heuristics. */
export function filterIdsFromTokenBundle(
  bundle: PulseTokenBundle,
  chain: AppChainId,
): string[] {
  const ids = new Set<string>(filterIdsFromTokenRow(bundle.token));

  const brandId = resolveLaunchpadProtocolFromBundle(bundle, chain);
  if (brandId && isSupportedFilterId(chain, brandId)) {
    ids.add(brandId);
  }

  const fromPad = launchPadToProtocolId(bundle.token.launch_pad, chain);
  if (fromPad && isSupportedFilterId(chain, fromPad)) {
    ids.add(fromPad);
  }

  const dexId = extractDexIdFromBundle(bundle);
  if (dexId) {
    const fromDex = protocolBrandIdFromDexId(dexId, chain);
    if (fromDex && isSupportedFilterId(chain, fromDex)) {
      ids.add(fromDex);
    }
  }

  if (bundle.token.protocol_id === 'pump_fun_mayhem' && isSupportedFilterId(chain, 'mayhem')) {
    ids.add('mayhem');
  }

  if (chain === 'sol' && bundle.token.mint.toLowerCase().endsWith('pump')) {
    if (isSupportedFilterId(chain, 'pump.fun')) ids.add('pump.fun');
  }

  return [...ids];
}
