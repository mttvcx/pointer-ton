import { protocolIdToFilterId } from '@/lib/protocol/registry';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '@/lib/protocol/types';
import { launchPadToProtocolId } from '@/lib/tokens/protocolBrand';
import type { AppChainId } from '@/lib/chains/appChain';

/** Map ingest fields → Pulse filter ids for alert rule matching (no TON bucket collapse). */
export function launchpadToAlertFilterIds(
  launchPad: string | null | undefined,
  protocolId: string | null | undefined,
  sourceConfidence: number | null | undefined,
  chain: AppChainId = 'sol',
): string[] {
  const conf = sourceConfidence ?? 0;
  if (protocolId && conf >= PROTOCOL_FILTER_MIN_CONFIDENCE) {
    const filterId = protocolIdToFilterId(protocolId);
    if (filterId) return [filterId];
    if (protocolId === 'ton') return ['ton'];
    if (protocolId === 'eth') return ['eth'];
    if (protocolId === 'bsc') return ['bsc'];
    if (protocolId === 'base') return ['base'];
  }
  const fromPad = launchPadToProtocolId(launchPad ?? null, chain);
  return fromPad ? [fromPad] : [];
}

export function alertProtocolFilterMatches(
  launchPad: string | null | undefined,
  protocolId: string | null | undefined,
  sourceConfidence: number | null | undefined,
  filter: string[] | undefined,
  chain: AppChainId = 'sol',
): boolean {
  if (!filter || filter.length === 0) return true;
  const detected = new Set(launchpadToAlertFilterIds(launchPad, protocolId, sourceConfidence, chain));
  return filter.some((f) => detected.has(f));
}
