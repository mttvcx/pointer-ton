import type { AppChainId } from '@/lib/chains/appChain';
import {
  PULSE_SUPPORTED_FILTER_IDS,
  supportedFilterIdsForChain,
  isSupportedFilterId,
} from '@/lib/protocol/registry';
import { protocolBrand } from '@/lib/tokens/protocolBrand';

/** Union of every filter id accepted in stored presets (supported protocols only). */
export const ALL_PULSE_PROTOCOL_FILTER_IDS = [
  ...new Set(Object.values(PULSE_SUPPORTED_FILTER_IDS).flat()),
] as const;

export type PulseColumnProtocolFilterId = (typeof ALL_PULSE_PROTOCOL_FILTER_IDS)[number];

/** @deprecated legacy registry — use {@link supportedFilterIdsForChain} */
export const PULSE_FILTER_PROTOCOL_IDS = PULSE_SUPPORTED_FILTER_IDS;

export function pulseProtocolPresetIdsForChain(chain: AppChainId): readonly string[] {
  return supportedFilterIdsForChain(chain);
}

export function defaultProtocolsForChain(chain: AppChainId): string[] {
  return [...supportedFilterIdsForChain(chain)];
}

export function isKnownPresetProtocol(id: string): boolean {
  return ALL_PULSE_PROTOCOL_FILTER_IDS.includes(id as PulseColumnProtocolFilterId);
}

/** UI labels — extend as new venues ship */
export const PULSE_COLUMN_PROTOCOL_LABEL: Record<string, string> = {
  ton: 'TON',
  'pump.fun': 'Pump',
  bonk: 'Bonk',
  moonshot: 'Moonshot',
  bags: 'Bags',
  mayhem: 'Mayhem',
  heaven: 'Heaven',
  'dynamic-bc': 'Dynamic BC',
  printr: 'Printr',
  meteora: 'Meteora',
  raydium: 'Raydium',
  'four.meme': 'Four.meme',
  flap: 'Flap',
  pancakeswap: 'PancakeSwap',
  uniswap: 'Uniswap',
  'uniswap-v2': 'Uniswap V2',
  'uniswap-v3': 'Uniswap V3',
  'uniswap-v4': 'Uniswap V4',
  eth: 'Ethereum (new pools)',
  clanker: 'Clanker',
  bsc: 'BNB (new pools)',
  base: 'Base (new pools)',
};

export { isSupportedFilterId, supportedFilterIdsForChain, PULSE_SUPPORTED_FILTER_IDS };

/** Brand color for protocol filter pills (falls back to muted gray). */
export function pulseProtocolAccentColor(id: string): string {
  return protocolBrand(id)?.color ?? '#888888';
}
