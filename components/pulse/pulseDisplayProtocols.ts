import type { AppChainId } from '@/lib/chains/appChain';
import { protocolBrand, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/** Launchpads shown in Display → Row protocol color grid, scoped to header chain. */
export const PULSE_DISPLAY_PROTOCOL_IDS_BY_CHAIN: Record<AppChainId, readonly ProtocolBrandId[]> = {
  sol: [
    'pump.fun',
    'bonk',
    'moonshot',
    'moonit',
    'bags',
    'bonkers',
    'printr',
    'liquid',
    'surge',
    'soar',
    'mayhem',
    'heaven',
    'believe',
    'boop',
    'dynamic-bc',
    'daos.fun',
    'jupiter-studio',
    'raydium',
    'launchlab',
    'orca',
    'meteora',
  ],
  ton: ['uranus', 'groypad', 'blum', 'tonfun'],
  eth: ['uniswap-v2', 'uniswap-v3', 'uniswap-v4', 'clanker', 'virtuals', 'eth'],
  bnb: ['four.meme', 'flap', 'pancakeswap', 'uniswap'],
  base: [
    'clanker',
    'bankr',
    'flaunch',
    'zora-content',
    'zora-creator',
    'baseapp',
    'basememe',
    'virtuals',
    'klik',
  ],
} as const;

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
