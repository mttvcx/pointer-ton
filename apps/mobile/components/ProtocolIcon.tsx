import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

/**
 * Real protocol / launchpad / chain / token logos, ported 1:1 from pointer-web
 * (`lib/tokens/protocolBrand.ts` + `lib/chains/chainAssets.ts`). The screener no
 * longer renders text labels (pump / bonk / moonshot …) and never invents an icon:
 * an unknown `launch_pad` resolves to `null` and the caller draws nothing.
 *
 * Metro requires literal `require()` paths, so the asset map below is a static
 * object literal keyed by the canonical protocol id (the web's logo filename stem).
 * Only ids whose PNG/WEBP actually ships under `assets/protocols/` are listed —
 * the web brand map references a few (believe, boop, dedust, stonfi, megaton) that
 * have no shipped artwork, so they are intentionally absent and resolve to null.
 */

// ── Canonical protocol id → bundled asset ───────────────────────────────────
// Keys mirror the web `logoFile` stem (so `pump.fun` → pumpfun.png, etc.).
const PROTOCOL_ASSETS: Record<string, ImageSourcePropType> = {
  'pump.fun': require('../assets/protocols/pumpfun.png'),
  bonk: require('../assets/protocols/bonk.png'),
  moonshot: require('../assets/protocols/moonshot.png'),
  moonit: require('../assets/protocols/moonit.png'),
  bags: require('../assets/protocols/bags.png'),
  printr: require('../assets/protocols/printr.png'),
  liquid: require('../assets/protocols/liquid.png'),
  surge: require('../assets/protocols/surge.png'),
  soar: require('../assets/protocols/soar.png'),
  mayhem: require('../assets/protocols/mayhem.png'),
  heaven: require('../assets/protocols/heaven.png'),
  'dynamic-bc': require('../assets/protocols/dynamic-bc.png'),
  'daos.fun': require('../assets/protocols/daos.png'),
  'jupiter-studio': require('../assets/protocols/jupiter-studio.png'),
  jupiter: require('../assets/protocols/jupiter.png'),
  raydium: require('../assets/protocols/raydium.png'),
  launchlab: require('../assets/protocols/launchlab.png'),
  orca: require('../assets/protocols/orca.png'),
  meteora: require('../assets/protocols/meteora.png'),
  'four.meme': require('../assets/protocols/four-meme.png'),
  flap: require('../assets/protocols/flap.webp'),
  pancakeswap: require('../assets/protocols/pancakeswap.png'),
  uniswap: require('../assets/protocols/uniswap.png'),
  'uniswap-v2': require('../assets/protocols/uniswap.png'),
  'uniswap-v3': require('../assets/protocols/uniswap.png'),
  'uniswap-v4': require('../assets/protocols/uniswap.png'),
  eth: require('../assets/protocols/eth.png'),
  clanker: require('../assets/protocols/clanker.png'),
  bankr: require('../assets/protocols/bankr.png'),
  flaunch: require('../assets/protocols/flaunch.png'),
  'zora-content': require('../assets/protocols/zora.png'),
  'zora-creator': require('../assets/protocols/zora.png'),
  baseapp: require('../assets/protocols/baseapp.png'),
  basememe: require('../assets/protocols/basememe.png'),
  virtuals: require('../assets/protocols/virtuals.png'),
  klik: require('../assets/protocols/klik.png'),
  uranus: require('../assets/protocols/uranus.png'),
  groypad: require('../assets/protocols/groypad.png'),
  blum: require('../assets/protocols/blum.png'),
  tonfun: require('../assets/protocols/tonfun.png'),
  bsc: require('../assets/protocols/bsc.png'),
  base: require('../assets/protocols/base.png'),
  ton: require('../assets/protocols/ton.png'),
};

/** `bonk` ships on a transparent bg → tint a chip behind it, matching web's `bg-[#f7931a]`. */
const PROTOCOL_CHIP_BG: Record<string, string> = {
  bonk: '#f7931a',
};

// ── Alias resolution (mirrors web `protocolBrand` aliases) ───────────────────
function resolveBrandId(id: string): string | null {
  if (id in PROTOCOL_ASSETS) return id;
  if (id === 'moonit') return 'moonshot';
  if (id === 'pump' || id === 'pumpfun') return 'pump.fun';
  if (id === 'jupstudio' || id === 'jupiter_studio') return 'jupiter-studio';
  if (id === 'wavebreak') return 'orca';
  if (id === 'meteora_amm' || id === 'meteora-amm' || id === 'meteora_amm_v2' || id === 'meteora-amm-v2') {
    return 'meteora';
  }
  if (id === 'fourmeme' || id === 'four-meme' || id === 'four_meme' || id === '4meme') return 'four.meme';
  if (id === 'pancake' || id === 'pancake_swap' || id === 'pancakeswap-v3') return 'pancakeswap';
  if (id === 'uniswap-v2' || id === 'uniswap_v2') return 'uniswap-v2';
  if (id === 'uniswap-v3' || id === 'uniswap_v3') return 'uniswap-v3';
  if (id === 'uniswap-v4' || id === 'uniswap_v4') return 'uniswap-v4';
  if (id === 'ethereum') return 'eth';
  if (id === 'zora_content' || id === 'zora-content') return 'zora-content';
  if (id === 'zora_creator' || id === 'zora-creator') return 'zora-creator';
  if (id === 'virtuals-uni' || id === 'virtuals_uni') return 'virtuals';
  return null;
}

// ── launch_pad string → canonical protocol id (web `launchPadToProtocolId`) ──
// Mobile receives the raw `launch_pad` without an active-chain hint, so we run the
// chains in priority order (SOL-first screener) and take the first match. Each
// chain's matcher only returns ids that have shipped artwork.
function matchSol(p: string): string | null {
  if (p === 'pump' || p === 'pumpfun') return 'pump.fun';
  if (p === 'daos' || p === 'daos.fun') return 'daos.fun';
  if (p === 'dynamic_bc' || p === 'dynamic bc' || p === 'dbc') return 'dynamic-bc';
  if (p === 'jupiter_studio' || p === 'jupstudio') return 'jupiter-studio';
  if (p === 'wavebreak') return 'orca';
  if (p === 'meteora_amm' || p === 'meteora amm' || p === 'meteora amm v2' || p === 'meteora-amm-v2') {
    return 'meteora';
  }
  const solIds = [
    'pump.fun', 'bonk', 'moonshot', 'bags', 'printr', 'liquid', 'surge',
    'soar', 'mayhem', 'heaven', 'dynamic-bc', 'daos.fun', 'jupiter-studio',
    'raydium', 'launchlab', 'orca', 'meteora',
  ];
  if (solIds.includes(p)) return p;
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
  if (p.includes('boop')) return null; // web maps to 'boop' but no shipped artwork
  if (p.includes('believe') || p.includes('launchcoin')) return null; // no shipped artwork
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
  if (p.includes('raydium') || p.includes('clmm')) return 'raydium';
  return null;
}

function matchEth(p: string): string | null {
  const ethIds = ['uniswap-v2', 'uniswap-v3', 'uniswap-v4', 'clanker', 'virtuals', 'eth'];
  if (ethIds.includes(p)) return p;
  if (p.includes('uniswap') && p.includes('v4')) return 'uniswap-v4';
  if (p.includes('uniswap') && p.includes('v3')) return 'uniswap-v3';
  if (p.includes('uniswap')) return 'uniswap-v2';
  if (p.includes('clanker')) return 'clanker';
  if (p.includes('virtual')) return 'virtuals';
  if (p === 'ethereum' || p === 'eth') return 'eth';
  return null;
}

function matchBnb(p: string): string | null {
  if (p === 'four.meme' || p === 'fourmeme' || p === 'four_meme' || p === '4meme') return 'four.meme';
  if (p.includes('four') && p.includes('meme')) return 'four.meme';
  if (p === 'flap' || p.includes('flap.sh')) return 'flap';
  if (p === 'pancakeswap' || p === 'pancake' || p.includes('pancake swap') || p.includes('pancakeswap v3')) {
    return 'pancakeswap';
  }
  if (p === 'uniswap' || p.includes('uniswap v4') || p.includes('uniswap-v4')) return 'uniswap';
  const bnbIds = ['four.meme', 'flap', 'pancakeswap', 'uniswap', 'bsc'];
  if (bnbIds.includes(p)) return p;
  if (p === 'bsc' || p.includes('bnb')) return 'bsc';
  return null;
}

function matchBase(p: string): string | null {
  const baseIds = [
    'clanker', 'bankr', 'flaunch', 'zora-content', 'zora-creator',
    'baseapp', 'basememe', 'virtuals', 'klik', 'base',
  ];
  if (baseIds.includes(p)) return p;
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

function matchTon(p: string): string | null {
  // dedust / stonfi / megaton are in the web map but have no shipped artwork.
  const tonIds = ['uranus', 'groypad', 'blum', 'tonfun', 'ton'];
  if (tonIds.includes(p)) return p;
  if (p.includes('uranus')) return 'uranus';
  if (p.includes('groypad') || p.includes('groy')) return 'groypad';
  if (p.includes('blum')) return 'blum';
  if (p.includes('tonfun') || p === 'ton.fun') return 'tonfun';
  if (p === 'ton' || p === 'tonapi') return 'ton';
  return null;
}

/** Resolve a raw `launch_pad` string to a canonical protocol id, or null if unknown. */
export function resolveProtocolId(launchPad: string | null | undefined): string | null {
  if (!launchPad) return null;
  const p = launchPad.toLowerCase().trim();
  if (!p) return null;
  return (
    matchSol(p) ??
    matchEth(p) ??
    matchBnb(p) ??
    matchBase(p) ??
    matchTon(p) ??
    resolveBrandId(p)
  );
}

/** Bundled launchpad/protocol logo for a raw `launch_pad`, or null if unknown. */
export function protocolLogoSource(launchPad: string | null | undefined): ImageSourcePropType | null {
  const id = resolveProtocolId(launchPad);
  if (!id) return null;
  const resolved = resolveBrandId(id) ?? id;
  return PROTOCOL_ASSETS[resolved] ?? null;
}

/**
 * Small rounded launchpad logo. Renders `null` for unknown / missing pads — never a
 * text fallback, never a made-up icon.
 */
export function ProtocolIcon({
  launchPad,
  size = 14,
  style,
}: {
  launchPad?: string | null;
  size?: number;
  style?: ViewStyle;
}) {
  const id = resolveProtocolId(launchPad);
  if (!id) return null;
  const resolved = resolveBrandId(id) ?? id;
  const source = PROTOCOL_ASSETS[resolved];
  if (!source) return null;

  const chipBg = PROTOCOL_CHIP_BG[resolved];
  const radius = size / 2;
  const pad = chipBg ? Math.max(1, Math.round(size * 0.12)) : 0;

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, overflow: 'hidden' },
        chipBg ? { backgroundColor: chipBg, padding: pad } : null,
        style,
      ]}
    >
      <Image source={source} style={s.img} resizeMode="cover" />
    </View>
  );
}

// ── Chain + token marks (real artwork under assets/crypto/) ──────────────────
const CRYPTO_ASSETS: Record<string, ImageSourcePropType> = {
  sol: require('../assets/crypto/sol.png'),
  eth: require('../assets/crypto/eth.png'),
  bnb: require('../assets/crypto/bnb.png'),
  base: require('../assets/crypto/base.png'),
  ton: require('../assets/crypto/ton.png'),
  btc: require('../assets/crypto/btc.png'),
  usdc: require('../assets/crypto/usdc.png'),
  xrp: require('../assets/crypto/xrp.png'),
};

// symbol / chain aliases → canonical crypto asset key.
const CRYPTO_ALIASES: Record<string, string> = {
  solana: 'sol',
  ethereum: 'eth',
  weth: 'eth',
  bitcoin: 'btc',
  wbtc: 'btc',
  bsc: 'bnb',
  binance: 'bnb',
  'usd-coin': 'usdc',
  usdcoin: 'usdc',
};

/** Real chain/token logo for a symbol or chain slug (e.g. 'SOL', 'usdc', 'base'), or null. */
export function cryptoLogoSource(symbolOrChain: string | null | undefined): ImageSourcePropType | null {
  if (!symbolOrChain) return null;
  const key = symbolOrChain.trim().toLowerCase().replace(/^\$/, '');
  if (!key) return null;
  const canonical = key in CRYPTO_ASSETS ? key : CRYPTO_ALIASES[key];
  if (!canonical) return null;
  return CRYPTO_ASSETS[canonical] ?? null;
}

/** Small rounded chain/token mark (clean SOL / USDC / chain logos). Null if unknown. */
export function CryptoMark({
  symbol,
  size = 14,
  style,
}: {
  symbol?: string | null;
  size?: number;
  style?: ViewStyle;
}) {
  const source = cryptoLogoSource(symbol);
  if (!source) return null;
  const radius = size / 2;
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>
      <Image source={source} style={s.img} resizeMode="cover" />
    </View>
  );
}

const s = StyleSheet.create({
  img: { width: '100%', height: '100%' },
});
