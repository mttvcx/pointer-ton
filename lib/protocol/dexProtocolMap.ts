import type { AppChainId } from '@/lib/chains/appChain';
import type { CanonicalProtocolId } from '@/lib/protocol/types';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/** Generic chain buckets — never used for launchpad avatar rings. */
export const CHAIN_BUCKET_AVATAR_PROTOCOLS = new Set<ProtocolBrandId>([
  'bsc',
  'eth',
  'base',
  'ton',
]);

export function isChainBucketAvatarProtocol(id: string | null | undefined): boolean {
  return !!id && CHAIN_BUCKET_AVATAR_PROTOCOLS.has(id as ProtocolBrandId);
}

/** Map DexScreener / snapshot dexId slugs to protocol brand ids. */
export function protocolBrandIdFromDexId(
  dexIdRaw: string,
  _chain: AppChainId,
): ProtocolBrandId | null {
  const dexId = dexIdRaw.trim().toLowerCase();
  if (!dexId) return null;
  if (dexId.includes('raydium')) return 'raydium';
  if (dexId.includes('meteora') || dexId.includes('damm') || dexId.includes('dlmm')) return 'meteora';
  if (dexId === 'pumpswap' || dexId === 'pumpfun' || dexId.includes('pump')) return 'pump.fun';
  if (dexId.includes('orca') || dexId.includes('wavebreak')) return 'orca';
  if (dexId.includes('uniswap')) return 'uniswap';
  if (dexId.includes('pancake')) return 'pancakeswap';
  if (dexId.includes('four') && dexId.includes('meme')) return 'four.meme';
  if (dexId.includes('flap')) return 'flap';
  if (dexId.includes('clanker')) return 'clanker';
  if (dexId.includes('bankr')) return 'bankr';
  if (dexId.includes('flaunch')) return 'flaunch';
  if (dexId.includes('zora') && dexId.includes('creator')) return 'zora-creator';
  if (dexId.includes('zora')) return 'zora-content';
  if (dexId.includes('virtual')) return 'virtuals';
  if (dexId.includes('klik')) return 'klik';
  if (dexId.includes('baseapp') || dexId === 'base-app') return 'baseapp';
  if (dexId.includes('basememe') || dexId.includes('base-meme')) return 'basememe';
  if (dexId === 'fourmeme' || dexId === '4meme') return 'four.meme';
  if (dexId.includes('tonfun')) return 'tonfun';
  if (dexId.includes('uranus')) return 'uranus';
  if (dexId.includes('groypad')) return 'groypad';
  if (dexId.includes('blum')) return 'blum';
  if (dexId.includes('dedust')) return 'dedust';
  if (dexId.includes('ston')) return 'stonfi';
  return null;
}

export function canonicalProtocolFromDexscreenerId(
  dexIdRaw: string,
  chain: AppChainId,
): CanonicalProtocolId | null {
  const brand = protocolBrandIdFromDexId(dexIdRaw, chain);
  if (!brand || isChainBucketAvatarProtocol(brand)) return null;
  const map: Partial<Record<string, CanonicalProtocolId>> = {
    'pump.fun': 'pump_fun',
    bonk: 'bonk',
    raydium: 'raydium',
    meteora: 'meteora',
    pancakeswap: 'pancakeswap',
    uniswap: 'uniswap',
    'uniswap-v2': 'uniswap_v2',
    'uniswap-v3': 'uniswap_v3',
    'uniswap-v4': 'uniswap_v4',
  };
  return map[brand] ?? null;
}
