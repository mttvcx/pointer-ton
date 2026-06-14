import type { AppChainId } from '@/lib/chains/appChain';
import { PULSE_SUPPORTED_FILTER_IDS } from '@/lib/protocol/registry';
import { protocolBrand, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/** Launchpads shown in Display → Row protocol color grid, scoped to header chain. */
export const PULSE_DISPLAY_PROTOCOL_IDS_BY_CHAIN: Record<
  AppChainId,
  readonly ProtocolBrandId[]
> = PULSE_SUPPORTED_FILTER_IDS as Record<AppChainId, readonly ProtocolBrandId[]>;

export function pulseDisplayProtocolIdsForChain(chain: AppChainId): readonly ProtocolBrandId[] {
  return PULSE_DISPLAY_PROTOCOL_IDS_BY_CHAIN[chain];
}

/** Union of every launchpad in the Display → Row grid (all chains). */
export const PULSE_DISPLAY_PROTOCOL_IDS = [
  ...new Set(Object.values(PULSE_DISPLAY_PROTOCOL_IDS_BY_CHAIN).flat()),
] as ProtocolBrandId[];

export function pulseDisplayProtocolLabel(id: ProtocolBrandId): string {
  return protocolBrand(id)?.label ?? id;
}

export function pulseDisplayProtocolColor(id: ProtocolBrandId): string {
  return protocolBrand(id)?.color ?? '#888';
}
