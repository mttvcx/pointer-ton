import type { AppChainId } from '@/lib/chains/appChain';

/** Local static assets under /public/logos/protocols — no runtime remote fetch. */
export const PROTOCOL_LOGO_BASE = '/logos/protocols';

export type ProtocolBrandId =
  | 'pump.fun'
  | 'bonk'
  | 'moonshot'
  | 'moonit'
  | 'bags'
  | 'bonkers'
  | 'printr'
  | 'liquid'
  | 'surge'
  | 'soar'
  | 'mayhem'
  | 'heaven'
  | 'believe'
  | 'boop'
  | 'dynamic-bc'
  | 'daos.fun'
  | 'jupiter-studio'
  | 'ton'
  | 'dedust'
  | 'stonfi'
  | 'megaton'
  | 'bsc'
  | 'base'
  | 'raydium'
  | 'launchlab'
  | 'orca'
  | 'meteora'
  | 'jupiter'
  | 'four.meme'
  | 'flap'
  | 'pancakeswap'
  | 'uniswap'
  | 'uniswap-v2'
  | 'uniswap-v3'
  | 'uniswap-v4'
  | 'eth'
  | 'noxa'
  | 'robinhood'
  | 'clanker'
  | 'bankr'
  | 'flaunch'
  | 'zora-content'
  | 'zora-creator'
  | 'baseapp'
  | 'basememe'
  | 'virtuals'
  | 'klik'
  | 'uranus'
  | 'groypad'
  | 'blum'
  | 'tonfun';

export type ProtocolBrand = {
  id: ProtocolBrandId;
  label: string;
  color: string;
  logoFile: string;
  tooltip?: string;
};

const BRANDS: Record<ProtocolBrandId, ProtocolBrand> = {
  'pump.fun': {
    id: 'pump.fun',
    label: 'Pump',
    color: '#00c27a',
    logoFile: 'pumpfun.png',
  },
  bonk: {
    id: 'bonk',
    label: 'Bonk',
    color: '#f7931a',
    logoFile: 'bonk.png',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Moonshot',
    color: '#e879f9',
    logoFile: 'moonshot.png',
  },
  moonit: {
    id: 'moonit',
    label: 'Moonit',
    color: '#a3e635',
    logoFile: 'moonit.png',
    tooltip: 'Moon.it',
  },
  bags: {
    id: 'bags',
    label: 'Bags',
    color: '#059669',
    logoFile: 'bags.png',
  },
  bonkers: {
    id: 'bonkers',
    label: 'Bonkers',
    color: '#ff6b9d',
    logoFile: 'bonkers.png',
  },
  printr: {
    id: 'printr',
    label: 'Printr',
    color: '#c084fc',
    logoFile: 'printr.png',
  },
  liquid: {
    id: 'liquid',
    label: 'Liquid',
    color: '#3498db',
    logoFile: 'liquid.png',
  },
  surge: {
    id: 'surge',
    label: 'Surge',
    color: '#4ade80',
    logoFile: 'surge.png',
  },
  soar: {
    id: 'soar',
    label: 'Soar',
    color: '#00bcd4',
    logoFile: 'soar.png',
  },
  mayhem: {
    id: 'mayhem',
    label: 'Mayhem',
    color: '#ff3355',
    logoFile: 'mayhem.png',
  },
  heaven: {
    id: 'heaven',
    label: 'Heaven',
    color: '#b39ddb',
    logoFile: 'heaven.avif',
  },
  believe: {
    id: 'believe',
    label: 'Believe',
    color: '#22c55e',
    logoFile: 'believe.png',
    tooltip: 'Believe / @launchcoin',
  },
  boop: {
    id: 'boop',
    label: 'Boop.fun',
    color: '#f472b6',
    logoFile: 'boop.png',
  },
  'dynamic-bc': {
    id: 'dynamic-bc',
    label: 'Dynamic BC',
    color: '#c54b5c',
    logoFile: 'dynamic-bc.png',
    tooltip: 'Dynamic Bonding Curve',
  },
  'daos.fun': {
    id: 'daos.fun',
    label: 'Daos.fun',
    color: '#38bdf8',
    logoFile: 'daos.png',
  },
  'jupiter-studio': {
    id: 'jupiter-studio',
    label: 'Jupiter Studio',
    color: '#fb923c',
    logoFile: 'jupiter-studio.png',
    tooltip: 'Jupiter Studio',
  },
  ton: { id: 'ton', label: 'TON Index', color: '#0098ea', logoFile: 'ton.png' },
  dedust: { id: 'dedust', label: 'DeDust', color: '#7c5cff', logoFile: 'dedust.png' },
  stonfi: { id: 'stonfi', label: 'STON.fi', color: '#00b4ff', logoFile: 'stonfi.png' },
  megaton: { id: 'megaton', label: 'Megaton', color: '#ff6b35', logoFile: 'megaton.png' },
  bsc: { id: 'bsc', label: 'BNB', color: '#f0b90b', logoFile: 'bsc.png' },
  base: { id: 'base', label: 'Base', color: '#0052ff', logoFile: 'base.png' },
  robinhood: { id: 'robinhood', label: 'Robinhood', color: '#CCFF00', logoFile: 'robinhood.svg', tooltip: 'Robinhood Chain — new pools' },
  noxa: { id: 'noxa', label: 'Noxa', color: '#d4a017', logoFile: 'noxa.png', tooltip: 'Noxa launchpad (fun.noxa.fi)' },
  raydium: {
    id: 'raydium',
    label: 'Raydium',
    color: '#c200fa',
    logoFile: 'raydium.png',
    tooltip: 'Raydium CLMM',
  },
  launchlab: {
    id: 'launchlab',
    label: 'LaunchLab',
    color: '#22d3ee',
    logoFile: 'launchlab.png',
    tooltip: 'Raydium LaunchLab',
  },
  orca: {
    id: 'orca',
    label: 'Orca',
    color: '#eab308',
    logoFile: 'orca.png',
    tooltip: 'Wavebreak',
  },
  meteora: {
    id: 'meteora',
    label: 'Meteora',
    color: '#f97316',
    logoFile: 'meteora.png',
    tooltip: 'Meteora AMM V2',
  },
  jupiter: {
    id: 'jupiter',
    label: 'Jupiter',
    color: '#00cfbe',
    logoFile: 'jupiter.png',
  },
  'four.meme': {
    id: 'four.meme',
    label: 'Four.meme',
    color: '#4ade80',
    logoFile: 'four-meme.png',
    tooltip: 'Four.meme',
  },
  flap: {
    id: 'flap',
    label: 'Flap',
    color: '#a78bfa',
    logoFile: 'flap.webp',
    tooltip: 'Flap',
  },
  pancakeswap: {
    id: 'pancakeswap',
    label: 'Pancakeswap',
    color: '#d1884f',
    logoFile: 'pancakeswap.png',
    tooltip: 'PancakeSwap V3',
  },
  uniswap: {
    id: 'uniswap',
    label: 'Uniswap',
    color: '#ff007a',
    logoFile: 'uniswap.png',
    tooltip: 'Uniswap V4',
  },
  'uniswap-v2': {
    id: 'uniswap-v2',
    label: 'Uniswap V2',
    color: '#ff4d6d',
    logoFile: 'uniswap.png',
  },
  'uniswap-v3': {
    id: 'uniswap-v3',
    label: 'Uniswap V3',
    color: '#ff49c8',
    logoFile: 'uniswap.png',
  },
  'uniswap-v4': {
    id: 'uniswap-v4',
    label: 'Uniswap V4',
    color: '#498cff',
    logoFile: 'uniswap.png',
  },
  eth: {
    id: 'eth',
    label: 'Ethereum',
    color: '#627eea',
    logoFile: 'eth.png',
  },
  clanker: {
    id: 'clanker',
    label: 'Clanker',
    color: '#a855f7',
    logoFile: 'clanker.png',
  },
  bankr: {
    id: 'bankr',
    label: 'Bankr',
    color: '#9333ea',
    logoFile: 'bankr.png',
  },
  flaunch: {
    id: 'flaunch',
    label: 'Flaunch',
    color: '#d946ef',
    logoFile: 'flaunch.png',
  },
  'zora-content': {
    id: 'zora-content',
    label: 'Zora Content',
    color: '#498cff',
    logoFile: 'zora.png',
  },
  'zora-creator': {
    id: 'zora-creator',
    label: 'Zora Creator',
    color: '#498cff',
    logoFile: 'zora.png',
  },
  baseapp: {
    id: 'baseapp',
    label: 'Baseapp',
    color: '#0052ff',
    logoFile: 'baseapp.png',
  },
  basememe: {
    id: 'basememe',
    label: 'Basememe',
    color: '#3b82f6',
    logoFile: 'basememe.png',
  },
  virtuals: {
    id: 'virtuals',
    label: 'Virtuals Uni',
    color: '#22c55e',
    logoFile: 'virtuals.png',
  },
  klik: {
    id: 'klik',
    label: 'Klik',
    color: '#8b5cf6',
    logoFile: 'klik.png',
  },
  uranus: {
    id: 'uranus',
    label: 'Uranus',
    color: '#22d3ee',
    logoFile: 'uranus.png',
  },
  groypad: {
    id: 'groypad',
    label: 'Groypad',
    color: '#4ade80',
    logoFile: 'groypad.png',
  },
  blum: {
    id: 'blum',
    label: 'Blum',
    color: '#a78bfa',
    logoFile: 'blum.png',
  },
  tonfun: {
    id: 'tonfun',
    label: 'Tonfun',
    color: '#38bdf8',
    logoFile: 'tonfun.png',
  },
};

export function protocolBrand(id: string): ProtocolBrand | null {
  if (id in BRANDS) return BRANDS[id as ProtocolBrandId];
  if (id === 'moonit') return BRANDS.moonshot;
  if (id === 'pump' || id === 'pumpfun') return BRANDS['pump.fun'];
  if (id === 'jupstudio' || id === 'jupiter_studio') return BRANDS['jupiter-studio'];
  if (id === 'wavebreak') return BRANDS.orca;
  if (id === 'meteora_amm' || id === 'meteora-amm' || id === 'meteora_amm_v2' || id === 'meteora-amm-v2') {
    return BRANDS.meteora;
  }
  if (id === 'fourmeme' || id === 'four-meme' || id === 'four_meme' || id === '4meme') {
    return BRANDS['four.meme'];
  }
  if (id === 'pancake' || id === 'pancake_swap' || id === 'pancakeswap-v3') {
    return BRANDS.pancakeswap;
  }
  if (id === 'uniswap-v2' || id === 'uniswap_v2') return BRANDS['uniswap-v2'];
  if (id === 'uniswap-v3' || id === 'uniswap_v3') return BRANDS['uniswap-v3'];
  if (id === 'uniswap-v4' || id === 'uniswap_v4') return BRANDS['uniswap-v4'];
  if (id === 'ethereum') return BRANDS.eth;
  if (id === 'zora_content' || id === 'zora-content') return BRANDS['zora-content'];
  if (id === 'zora_creator' || id === 'zora-creator') return BRANDS['zora-creator'];
  if (id === 'virtuals-uni' || id === 'virtuals_uni') return BRANDS.virtuals;
  return null;
}

export function protocolLogoSrc(id: string): string {
  const b = protocolBrand(id);
  if (!b) return `${PROTOCOL_LOGO_BASE}/default.png`;
  return `${PROTOCOL_LOGO_BASE}/${b.logoFile}`;
}

/** Map ingest `launch_pad` strings → canonical filter protocol id. */
export function launchPadToProtocolId(pad: string | null | undefined, chain: AppChainId): string | null {
  if (!pad) return null;
  const p = pad.toLowerCase().trim();
  if (chain === 'sol') {
    if (p === 'pump' || p === 'pumpfun') return 'pump.fun';
    if (p === 'daos' || p === 'daos.fun') return 'daos.fun';
    if (p === 'dynamic_bc' || p === 'dynamic bc' || p === 'dbc') return 'dynamic-bc';
    if (p === 'jupiter_studio' || p === 'jupstudio') return 'jupiter-studio';
    if (p === 'wavebreak') return 'orca';
    if (p === 'meteora_amm' || p === 'meteora amm' || p === 'meteora amm v2' || p === 'meteora-amm-v2') {
      return 'meteora';
    }
    const solIds = [
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
      'raydium',
      'launchlab',
      'orca',
      'meteora',
    ] as const;
    if ((solIds as readonly string[]).includes(p)) return p;
    if (p.includes('pump')) return 'pump.fun';
    if (p.includes('bonk')) return 'bonk';
    if (p.includes('moonit') || p.includes('moon.it') || p.includes('moonshot')) return 'moonshot';
    if (p.includes('bags')) return 'bags';
    if (p.includes('printr')) return 'printr';
    if (p.includes('liquid')) return 'liquid';
    if (p.includes('surge')) return 'surge';
    if (p.includes('soar')) return 'soar';
    if (p.includes('mayhem')) return 'mayhem';
    if (p.includes('heaven')) return 'heaven';
    if (p.includes('believe') || p.includes('launchcoin')) return 'believe';
    if (p.includes('boop')) return 'boop';
    if (p.includes('dynamic') && (p.includes('bc') || p.includes('bonding'))) return 'dynamic-bc';
    if (p.includes('meteora') && p.includes('dbc')) return 'dynamic-bc';
    if (p.includes('meteora') && (p.includes('amm') || p.includes('damm'))) return 'meteora';
    if (p === 'meteora') return 'meteora';
    if (p.includes('daos')) return 'daos.fun';
    if (p.includes('jupiter studio') || p.includes('jupstudio') || p.includes('studio.jup')) return 'jupiter-studio';
    if (p.includes('jupx')) return 'jupiter-studio';
    if (p.includes('launchlab') || p === 'launch_lab') return 'launchlab';
    if (p.includes('wavebreak') || (p.includes('orca') && p.includes('so'))) return 'orca';
    if (p === 'orca') return 'orca';
    if (p.includes('bonkers')) return 'bonkers';
    if (p.includes('raydium') || p.includes('clmm')) return 'raydium';
    return null;
  }
  if (chain === 'eth') {
    const ethIds = ['uniswap-v2', 'uniswap-v3', 'uniswap-v4', 'clanker', 'virtuals', 'eth'] as const;
    if ((ethIds as readonly string[]).includes(p)) return p;
    if (p.includes('uniswap') && p.includes('v4')) return 'uniswap-v4';
    if (p.includes('uniswap') && p.includes('v3')) return 'uniswap-v3';
    if (p.includes('uniswap')) return 'uniswap-v2';
    if (p.includes('clanker')) return 'clanker';
    if (p.includes('virtual')) return 'virtuals';
    if (p === 'ethereum' || p === 'eth') return 'eth';
    return null;
  }
  if (chain === 'bnb') {
    if (p === 'four.meme' || p === 'fourmeme' || p === 'four_meme' || p === '4meme') return 'four.meme';
    if (p.includes('four') && p.includes('meme')) return 'four.meme';
    if (p === 'flap' || p.includes('flap.sh')) return 'flap';
    if (p === 'pancakeswap' || p === 'pancake' || p.includes('pancake swap') || p.includes('pancakeswap v3')) {
      return 'pancakeswap';
    }
    if (p === 'uniswap' || p.includes('uniswap v4') || p.includes('uniswap-v4')) return 'uniswap';
    const bnbIds = ['four.meme', 'flap', 'pancakeswap', 'uniswap', 'bsc'] as const;
    if ((bnbIds as readonly string[]).includes(p)) return p;
    if (p === 'bsc' || p.includes('bnb')) return 'bsc';
    return null;
  }
  if (chain === 'base') {
    const baseIds = [
      'clanker',
      'bankr',
      'flaunch',
      'zora-content',
      'zora-creator',
      'baseapp',
      'basememe',
      'virtuals',
      'klik',
      'base',
    ] as const;
    if ((baseIds as readonly string[]).includes(p)) return p;
    if (p === 'zora_content' || p === 'zora content') return 'zora-content';
    if (p === 'zora_creator' || p === 'zora creator') return 'zora-creator';
    if (p.includes('clanker')) return 'clanker';
    if (p.includes('bankr')) return 'bankr';
    if (p.includes('flaunch')) return 'flaunch';
    if (p.includes('baseapp') || p === 'base app') return 'baseapp';
    if (p.includes('basememe') || p === 'base meme') return 'basememe';
    if (p.includes('virtual')) return 'virtuals';
    if (p.includes('klik')) return 'klik';
    if (p.includes('zora') && p.includes('creator')) return 'zora-creator';
    if (p.includes('zora')) return 'zora-content';
    return null;
  }
  if (chain === 'ton') {
    const tonIds = ['uranus', 'groypad', 'blum', 'tonfun', 'ton', 'dedust', 'stonfi', 'megaton'] as const;
    if ((tonIds as readonly string[]).includes(p)) return p;
    if (p.includes('uranus')) return 'uranus';
    if (p.includes('groypad') || p.includes('groy')) return 'groypad';
    if (p.includes('blum')) return 'blum';
    if (p.includes('tonfun') || p === 'ton.fun') return 'tonfun';
    if (p === 'ton' || p === 'tonapi') return 'ton';
    if (p.includes('dedust')) return 'dedust';
    if (p.includes('ston')) return 'stonfi';
    if (p.includes('megaton')) return 'megaton';
    return null;
  }
  return null;
}

export const QUOTE_TOKEN_BRANDS = {
  native: { label: 'SOL', color: '#9945ff', logoFile: 'sol.png' },
  usdc: { label: 'USDC', color: '#2775ca', logoFile: 'usdc.png' },
  usd1: { label: 'USD1', color: '#eab308', logoFile: 'usd1.png' },
} as const;
