import type { AppChainId } from '@/lib/chains/appChain';
import { protocolBrand } from '@/lib/tokens/protocolBrand';

/**
 * Pulse column filter → canonical protocol ids keyed by header chain.
 * Values should align with `tokens.launch_pad` / ingest when possible.
 */
export const PULSE_FILTER_PROTOCOL_IDS: Record<AppChainId, readonly string[]> = {
  ton: ['uranus', 'groypad', 'blum', 'tonfun'],
  sol: [
    'pump.fun',
    'bonk',
    'moonshot',
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
    'launchlab',
    'orca',
    'meteora',
    'raydium',
  ],
  bnb: ['four.meme', 'flap', 'pancakeswap', 'uniswap', 'bsc'],
  base: ['clanker', 'bankr', 'flaunch', 'zora-content', 'zora-creator', 'baseapp', 'basememe', 'virtuals', 'klik'],
} as const;

/** Union of every filter id accepted in stored presets / share payloads */
export const ALL_PULSE_PROTOCOL_FILTER_IDS = [
  ...PULSE_FILTER_PROTOCOL_IDS.ton,
  ...PULSE_FILTER_PROTOCOL_IDS.sol,
  ...PULSE_FILTER_PROTOCOL_IDS.bnb,
  ...PULSE_FILTER_PROTOCOL_IDS.base,
] as const;

export type PulseColumnProtocolFilterId = (typeof ALL_PULSE_PROTOCOL_FILTER_IDS)[number];

const ALL_IDS_SET = new Set<string>(ALL_PULSE_PROTOCOL_FILTER_IDS);

/** UI labels — extend as new venues ship */
export const PULSE_COLUMN_PROTOCOL_LABEL: Record<string, string> = {
  ton: 'TON Index',
  dedust: 'DeDust',
  stonfi: 'STON.fi',
  megaton: 'Megaton',
  uranus: 'Uranus',
  groypad: 'Groypad',
  blum: 'Blum',
  tonfun: 'Tonfun',
  'pump.fun': 'Pump',
  bonk: 'Bonk',
  moonshot: 'Moonshot',
  bags: 'Bags',
  bonkers: 'Bonkers',
  printr: 'Printr',
  liquid: 'Liquid',
  surge: 'Surge',
  soar: 'Soar',
  mayhem: 'Mayhem',
  heaven: 'Heaven',
  believe: 'Believe',
  boop: 'Boop.fun',
  'dynamic-bc': 'Dynamic BC',
  'daos.fun': 'Daos.fun',
  'jupiter-studio': 'Jupiter Studio',
  launchlab: 'LaunchLab',
  orca: 'Orca',
  meteora: 'Meteora AMM',
  raydium: 'Raydium',
  'four.meme': 'Four.meme',
  flap: 'Flap',
  pancakeswap: 'Pancakeswap',
  uniswap: 'Uniswap',
  clanker: 'Clanker',
  bankr: 'Bankr',
  flaunch: 'Flaunch',
  'zora-content': 'Zora Content',
  'zora-creator': 'Zora Creator',
  baseapp: 'Baseapp',
  basememe: 'Basememe',
  virtuals: 'Virtuals Uni',
  klik: 'Klik',
  bsc: 'BNB (new pools)',
  base: 'Base (new pools)',
};

export function pulseProtocolPresetIdsForChain(chain: AppChainId): readonly string[] {
  return PULSE_FILTER_PROTOCOL_IDS[chain];
}

export function defaultProtocolsForChain(chain: AppChainId): string[] {
  return [...PULSE_FILTER_PROTOCOL_IDS[chain]];
}

export function isKnownPresetProtocol(id: string): boolean {
  return ALL_IDS_SET.has(id);
}

/** Brand color for protocol filter pills (falls back to muted gray). */
export function pulseProtocolAccentColor(id: string): string {
  return protocolBrand(id)?.color ?? '#888888';
}
