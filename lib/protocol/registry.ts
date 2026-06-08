import type { AppChainId } from '@/lib/chains/appChain';
import { LAUNCHPAD_PROGRAM_IDS, MIGRATION_PROGRAM_IDS } from '@/lib/utils/constants';
import type { CanonicalProtocolId } from '@/lib/protocol/types';

export type ProtocolRegistryEntry = {
  protocol_id: CanonicalProtocolId;
  display_name: string;
  filter_id: string | null;
  chain_ids: AppChainId[];
  family: string;
  program_ids?: string[];
};

const SOL_LAUNCH_PROGRAMS: Record<string, CanonicalProtocolId> = {
  [LAUNCHPAD_PROGRAM_IDS.pumpFun]: 'pump_fun',
  [LAUNCHPAD_PROGRAM_IDS.bags]: 'bags',
  [LAUNCHPAD_PROGRAM_IDS.printr]: 'printr',
  [LAUNCHPAD_PROGRAM_IDS.moonshot]: 'moonshot',
  [LAUNCHPAD_PROGRAM_IDS.bonk]: 'bonk',
  [LAUNCHPAD_PROGRAM_IDS.heaven]: 'heaven',
  [LAUNCHPAD_PROGRAM_IDS.believeDbc]: 'dynamic_bc',
};

const MIGRATION_DEX: Record<string, CanonicalProtocolId> = {
  pumpswap: 'pumpswap',
  raydium: 'raydium',
  meteora: 'meteora',
};

export const LAUNCH_PAD_TO_PROTOCOL_ID: Record<string, CanonicalProtocolId> = {
  'pump.fun': 'pump_fun',
  pumpfun: 'pump_fun',
  pump: 'pump_fun',
  bonk: 'bonk',
  bags: 'bags',
  printr: 'printr',
  moonshot: 'moonshot',
  heaven: 'heaven',
  'dynamic-bc': 'dynamic_bc',
  dynamic_bc: 'dynamic_bc',
  eth: 'eth',
  bsc: 'bsc',
  base: 'base',
  ton: 'ton',
};

export const PROTOCOL_REGISTRY: ProtocolRegistryEntry[] = [
  { protocol_id: 'pump_fun', display_name: 'Pump.fun', filter_id: 'pump.fun', chain_ids: ['sol'], family: 'pump', program_ids: [LAUNCHPAD_PROGRAM_IDS.pumpFun] },
  { protocol_id: 'pump_fun_mayhem', display_name: 'Pump Mayhem', filter_id: 'mayhem', chain_ids: ['sol'], family: 'pump', program_ids: [LAUNCHPAD_PROGRAM_IDS.pumpFun] },
  { protocol_id: 'bonk', display_name: 'Bonk', filter_id: 'bonk', chain_ids: ['sol'], family: 'bonk', program_ids: [LAUNCHPAD_PROGRAM_IDS.bonk] },
  { protocol_id: 'bags', display_name: 'Bags', filter_id: 'bags', chain_ids: ['sol'], family: 'bags', program_ids: [LAUNCHPAD_PROGRAM_IDS.bags] },
  { protocol_id: 'printr', display_name: 'Printr', filter_id: 'printr', chain_ids: ['sol'], family: 'printr', program_ids: [LAUNCHPAD_PROGRAM_IDS.printr] },
  { protocol_id: 'moonshot', display_name: 'Moonshot', filter_id: 'moonshot', chain_ids: ['sol'], family: 'moonshot', program_ids: [LAUNCHPAD_PROGRAM_IDS.moonshot] },
  { protocol_id: 'heaven', display_name: 'Heaven', filter_id: 'heaven', chain_ids: ['sol'], family: 'heaven', program_ids: [LAUNCHPAD_PROGRAM_IDS.heaven] },
  { protocol_id: 'dynamic_bc', display_name: 'Dynamic BC', filter_id: 'dynamic-bc', chain_ids: ['sol'], family: 'meteora_dbc', program_ids: [LAUNCHPAD_PROGRAM_IDS.believeDbc] },
  { protocol_id: 'pumpswap', display_name: 'PumpSwap', filter_id: null, chain_ids: ['sol'], family: 'pump', program_ids: [MIGRATION_PROGRAM_IDS.pumpSwap] },
  { protocol_id: 'raydium', display_name: 'Raydium', filter_id: 'raydium', chain_ids: ['sol'], family: 'raydium' },
  { protocol_id: 'meteora', display_name: 'Meteora', filter_id: 'meteora', chain_ids: ['sol'], family: 'meteora' },
  { protocol_id: 'pancakeswap', display_name: 'PancakeSwap', filter_id: 'pancakeswap', chain_ids: ['bnb'], family: 'pancakeswap' },
  { protocol_id: 'uniswap', display_name: 'Uniswap', filter_id: 'uniswap', chain_ids: ['eth', 'bnb', 'base'], family: 'uniswap' },
  { protocol_id: 'uniswap_v2', display_name: 'Uniswap V2', filter_id: 'uniswap-v2', chain_ids: ['eth'], family: 'uniswap' },
  { protocol_id: 'uniswap_v3', display_name: 'Uniswap V3', filter_id: 'uniswap-v3', chain_ids: ['eth'], family: 'uniswap' },
  { protocol_id: 'uniswap_v4', display_name: 'Uniswap V4', filter_id: 'uniswap-v4', chain_ids: ['eth'], family: 'uniswap' },
  { protocol_id: 'eth', display_name: 'Ethereum', filter_id: 'eth', chain_ids: ['eth'], family: 'evm' },
  { protocol_id: 'bsc', display_name: 'BNB Chain', filter_id: 'bsc', chain_ids: ['bnb'], family: 'evm' },
  { protocol_id: 'base', display_name: 'Base', filter_id: 'base', chain_ids: ['base'], family: 'evm' },
  { protocol_id: 'ton', display_name: 'TON', filter_id: 'ton', chain_ids: ['ton'], family: 'ton' },
];

export const PULSE_SUPPORTED_FILTER_IDS: Record<AppChainId, readonly string[]> = {
  sol: ['pump.fun', 'mayhem', 'bonk', 'bags', 'printr', 'moonshot', 'heaven', 'dynamic-bc', 'raydium', 'meteora'],
  ton: ['ton'],
  eth: ['eth', 'uniswap-v2', 'uniswap-v3', 'uniswap-v4', 'uniswap'],
  bnb: ['bsc', 'pancakeswap'],
  base: ['base'],
};

export function protocolIdToFilterId(protocolId: string | null | undefined): string | null {
  if (!protocolId) return null;
  const row = PROTOCOL_REGISTRY.find((e) => e.protocol_id === protocolId);
  if (row?.filter_id) return row.filter_id;
  if (protocolId === 'ton') return 'ton';
  return null;
}

export function filterIdToProtocolIds(filterId: string): CanonicalProtocolId[] {
  return PROTOCOL_REGISTRY.filter((e) => e.filter_id === filterId).map((e) => e.protocol_id);
}

export function protocolFamilyFor(protocolId: CanonicalProtocolId): string {
  return PROTOCOL_REGISTRY.find((e) => e.protocol_id === protocolId)?.family ?? 'unknown';
}

export function solLaunchProtocolFromProgram(programId: string | null | undefined): CanonicalProtocolId | null {
  if (!programId) return null;
  return SOL_LAUNCH_PROGRAMS[programId] ?? null;
}

export function migrationDexProtocol(dest: string | null | undefined): CanonicalProtocolId | null {
  if (!dest) return null;
  return MIGRATION_DEX[dest.toLowerCase()] ?? null;
}

export function supportedFilterIdsForChain(chain: AppChainId): readonly string[] {
  return PULSE_SUPPORTED_FILTER_IDS[chain];
}

export function isSupportedFilterId(chain: AppChainId, filterId: string): boolean {
  return PULSE_SUPPORTED_FILTER_IDS[chain].includes(filterId);
}
