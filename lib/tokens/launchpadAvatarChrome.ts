import type { AppChainId } from '@/lib/chains/appChain';
import { LAUNCHPAD_PROGRAM_IDS } from '@/lib/utils/constants';
import { isPulseMayhemToken } from '@/lib/tokens/mayhemMode';
import {
  launchPadToProtocolId,
  protocolBrand,
  protocolLogoSrc,
  type ProtocolBrandId,
} from '@/lib/tokens/protocolBrand';
import type { PulseTokenBundle } from '@/types/tokens';

/** Raydium LaunchLab program (Bonk / LaunchLab bonding curve). */
const RAYDIUM_LAUNCHLAB_PROGRAM = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';

/** Launchpads that get Axiom-style avatar ring + corner badge on Pulse rows. */
export const LAUNCHPAD_AVATAR_PROTOCOLS = new Set<ProtocolBrandId>([
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
  'dynamic-bc',
  'daos.fun',
  'jupiter-studio',
  'raydium',
  'launchlab',
  'orca',
  'meteora',
  'four.meme',
  'flap',
  'pancakeswap',
  'uniswap',
  'clanker',
  'bankr',
  'flaunch',
  'zora-content',
  'zora-creator',
  'baseapp',
  'basememe',
  'virtuals',
  'klik',
  'uranus',
  'groypad',
  'blum',
  'tonfun',
]);

/** `launch_pad` values that show bonding-curve progress rings pre-migration. */
const BONDING_LAUNCH_PADS = new Set<string>([
  'pump.fun',
  'pumpfun',
  'pump',
  'bonk',
  'mayhem',
  'raydium',
  'launchlab',
  'launch_lab',
  'bags',
  'moonshot',
  'moonit',
  'printr',
  'soar',
  'surge',
  'heaven',
  'dynamic-bc',
  'dynamic_bc',
  'dbc',
  'daos',
  'daos.fun',
  'jupiter-studio',
  'jupiter_studio',
  'jupstudio',
  'orca',
  'wavebreak',
  'meteora',
  'meteora_amm',
  'meteora amm',
  'four.meme',
  'fourmeme',
  'four_meme',
  'flap',
  'pancakeswap',
  'pancake',
  'uniswap',
  'uniswap-v4',
  'clanker',
  'bankr',
  'flaunch',
  'zora-content',
  'zora-creator',
  'zora_content',
  'zora_creator',
  'zora',
  'baseapp',
  'basememe',
  'virtuals',
  'klik',
  'uranus',
  'groypad',
  'blum',
  'tonfun',
]);

export type LaunchpadRingStyle =
  | 'solid'
  | 'raydium-gradient'
  | 'printr-gradient'
  | 'jupiter-studio-gradient'
  | 'meteora-gradient';

export type LaunchpadAvatarChrome = {
  protocolId: ProtocolBrandId;
  /** Outer glow / wrap (box-shadow). */
  frameRgba: string;
  /** SVG progress / brand ring stroke when bonding ring is shown. */
  ringStrokeRgba: string;
  /** Axiom-style ring paint (Raydium = cyan → purple gradient). */
  ringStyle: LaunchpadRingStyle;
  cornerLogo: string;
  cornerTitle: string;
  cornerHref?: string;
  /** pump.fun only — animate fill from bonding curve instead of a solid brand ring. */
  showBondingProgress: boolean;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function brandRgba(protocolId: ProtocolBrandId, alpha = 0.92): string {
  const color = protocolBrand(protocolId)?.color ?? '#888888';
  return hexToRgba(color, alpha);
}

function cornerLogoFor(protocolId: ProtocolBrandId): string {
  return protocolLogoSrc(protocolId);
}

function externalHref(protocolId: ProtocolBrandId, mint: string): string | undefined {
  switch (protocolId) {
    case 'pump.fun':
      return `https://pump.fun/${encodeURIComponent(mint)}`;
    case 'bonk':
      return `https://letsbonk.fun/token/${encodeURIComponent(mint)}`;
    case 'mayhem':
      return `https://pump.fun/${encodeURIComponent(mint)}`;
    case 'bags':
      return `https://bags.fm/${encodeURIComponent(mint)}`;
    case 'moonshot':
    case 'moonit':
      return `https://moon.it/coin/${encodeURIComponent(mint)}`;
    case 'heaven':
      return `https://heaven.xyz/token/${encodeURIComponent(mint)}`;
    case 'raydium':
      return `https://raydium.io/swap/?inputMint=sol&outputMint=${encodeURIComponent(mint)}`;
    case 'launchlab':
      return `https://raydium.io/launchpad/token/?mint=${encodeURIComponent(mint)}`;
    case 'printr':
      return `https://app.printr.money/entry`;
    case 'soar':
      return `https://app.launchonsoar.com/`;
    case 'surge':
      return `https://app.surge.xyz/token/${encodeURIComponent(mint)}`;
    case 'dynamic-bc':
      return `https://app.meteora.ag/dynamic-pools/${encodeURIComponent(mint)}`;
    case 'daos.fun':
      return `https://daos.fun/dao/${encodeURIComponent(mint)}`;
    case 'jupiter-studio':
      return `https://jup.ag/tokens/${encodeURIComponent(mint)}`;
    case 'orca':
      return `https://www.orca.so/tokens/${encodeURIComponent(mint)}`;
    case 'meteora':
      return `https://app.meteora.ag/pools/${encodeURIComponent(mint)}`;
    case 'four.meme':
      return `https://four.meme/token/${encodeURIComponent(mint)}`;
    case 'flap':
      return `https://flap.sh/coin/${encodeURIComponent(mint)}`;
    case 'pancakeswap':
      return `https://pancakeswap.finance/swap?outputCurrency=${encodeURIComponent(mint)}&chain=bsc`;
    case 'uniswap':
      return `https://app.uniswap.org/explore/tokens/bnb/${encodeURIComponent(mint)}`;
    case 'clanker':
      return `https://www.clanker.world/clanker/${encodeURIComponent(mint)}`;
    case 'bankr':
      return `https://bankr.bot/token/${encodeURIComponent(mint)}`;
    case 'flaunch':
      return `https://flaunch.gg/token/${encodeURIComponent(mint)}`;
    case 'zora-content':
    case 'zora-creator':
      return `https://zora.co/coin/base:${encodeURIComponent(mint)}`;
    case 'baseapp':
      return `https://base.app/token/${encodeURIComponent(mint)}`;
    case 'basememe':
      return `https://basememe.fun/token/${encodeURIComponent(mint)}`;
    case 'virtuals':
      return `https://app.virtuals.io/`;
    case 'klik':
      return `https://klik.finance/token/${encodeURIComponent(mint)}`;
    case 'uranus':
      return `https://t.me/uranus_launchbot`;
    case 'groypad':
      return `https://groypad.io/jetton/${encodeURIComponent(mint)}`;
    case 'blum':
      return `https://blum.io/jetton/${encodeURIComponent(mint)}`;
    case 'tonfun':
      return `https://tonfun.io/token/${encodeURIComponent(mint)}`;
    default:
      return undefined;
  }
}

function inferProtocolFromMetadata(raw: unknown): ProtocolBrandId | null {
  if (raw == null) return null;
  let s: string;
  try {
    s = JSON.stringify(raw).toLowerCase();
  } catch {
    return null;
  }
  if (!s || s === 'null' || s === '{}') return null;

  const programPairs: [ProtocolBrandId, string][] = [
    ['pump.fun', LAUNCHPAD_PROGRAM_IDS.pumpFun],
    ['bags', LAUNCHPAD_PROGRAM_IDS.bags],
    ['printr', LAUNCHPAD_PROGRAM_IDS.printr],
    ['launchlab', RAYDIUM_LAUNCHLAB_PROGRAM],
    ['moonit', LAUNCHPAD_PROGRAM_IDS.moonshot],
  ];
  for (const [id, prog] of programPairs) {
    if (s.includes(prog.toLowerCase())) return id;
  }

  const keywordPairs: [ProtocolBrandId, string[]][] = [
    ['bonkers', ['bonkers', 'bonk.fun/bonkers']],
    ['bonk', ['letsbonk', 'letsbonk.fun', 'bonk launch', 'launch.lab', 'bonk.fun']],
    ['heaven', ['heaven.xyz', 'heaven launch', 'ascendonheaven', 'on heaven', '"heaven"', 'protocol":"heaven']],
    ['dynamic-bc', ['dynamic bc', 'dynamic-bc', 'dynamic bonding curve', 'meteora-dbc', 'meteora dbc', 'pooltype":"dynamic']],
    ['bags', ['bags.fm', 'bags launch', '"bags"']],
    ['printr', ['printr', 'pr1nt', 'pr1ntr', 'on printr', 'printr.money']],
    ['moonit', ['moonit', 'moon.it', 'on moonit', '.moon']],
    ['moonshot', ['moonshot', 'moon.cv', 'on moonshot']],
    ['liquid', ['liquid launch', 'liquid.fun']],
    ['surge', ['surge launch', 'surge.xyz', 'app.surge.xyz', 'on surge']],
    ['soar', ['soar launch', 'launchonsoar', 'launch on soar', 'on soar', 'app.launchonsoar']],
    ['mayhem', ['mayhem']],
    ['launchlab', ['launchlab', 'launch_lab', 'raydium launchlab', 'launchpadmodule', 'launch lab']],
    ['orca', ['orca.so', 'wavebreak', 'orca wavebreak', 'on orca']],
    ['meteora', ['meteora amm', 'meteora_amm', 'meteora amm v2', 'damm', 'damm-v2', 'dammv2', 'app.meteora.ag', 'meteora.ag']],
    ['raydium', ['raydium', 'raydium-clmm', 'clmm']],
    ['daos.fun', ['daos.fun', 'daos fun', 'api-daos', 'on daos', '.daos']],
    ['jupiter-studio', ['jupiter studio', 'jupiter-studio', 'studio.jup.ag', 'jupstudio', '.jupx', 'on jupiter studio']],
    ['pump.fun', ['pump.fun', 'pumpfun', 'pump fun']],
    ['four.meme', ['four.meme', 'fourmeme', 'four meme', '4meme']],
    ['flap', ['flap', 'flap.sh', 'flap launch']],
    ['pancakeswap', ['pancakeswap', 'pancake swap', 'pancakeswap v3', 'pancake v3']],
    ['uniswap', ['uniswap', 'uniswap v4', 'uniswap-v4', 'uni v4']],
    ['clanker', ['clanker', 'clanker.world', 'on clanker']],
    ['bankr', ['bankr', 'bankr.bot', 'bankrbot']],
    ['flaunch', ['flaunch', 'flaunch.gg']],
    ['zora-content', ['zora content', 'zora-content', 'zora coin']],
    ['zora-creator', ['zora creator', 'zora-creator', 'creator coin']],
    ['baseapp', ['baseapp', 'base app', 'base.app']],
    ['basememe', ['basememe', 'base meme']],
    ['virtuals', ['virtuals', 'virtuals.io', 'virtuals uni']],
    ['klik', ['klik', 'klik.finance']],
    ['uranus', ['uranus', 'uranus launch']],
    ['groypad', ['groypad', 'groy pad']],
    ['blum', ['blum', 'blum.io']],
    ['tonfun', ['tonfun', 'ton.fun launch', 'ton fun']],
  ];
  for (const [id, keys] of keywordPairs) {
    if (keys.some((k) => s.includes(k))) return id;
  }
  return null;
}

/** Resolve canonical launchpad protocol from `launch_pad` column + raw metadata. */
export function resolveLaunchpadProtocolFromBundle(
  bundle: PulseTokenBundle,
  chain: AppChainId = 'sol',
): ProtocolBrandId | null {
  if (isPulseMayhemToken(bundle)) return 'mayhem';

  const { token } = bundle;
  const mintLower = token.mint?.trim().toLowerCase() ?? '';
  if (mintLower.endsWith('pump')) return 'pump.fun';

  const fromPad = launchPadToProtocolId(token.launch_pad, chain);
  if (fromPad && LAUNCHPAD_AVATAR_PROTOCOLS.has(fromPad as ProtocolBrandId)) {
    return fromPad as ProtocolBrandId;
  }

  const fromTokenMeta = inferProtocolFromMetadata(token.raw_metadata);
  if (fromTokenMeta) return fromTokenMeta;

  const fromSnapMeta = inferProtocolFromMetadata(bundle.snapshot?.extended_metrics);
  if (fromSnapMeta) return fromSnapMeta;

  if (fromPad && LAUNCHPAD_AVATAR_PROTOCOLS.has(fromPad as ProtocolBrandId)) {
    return fromPad as ProtocolBrandId;
  }
  return fromPad as ProtocolBrandId | null;
}

export function resolveLaunchpadAvatarChrome(
  bundle: PulseTokenBundle,
  opts: {
    showFrame?: boolean;
    isMigrated?: boolean;
    pumpFunOnBondingCurve?: boolean;
    chain?: AppChainId;
  },
): LaunchpadAvatarChrome | null {
  if (opts.showFrame === false) return null;

  const protocolId = resolveLaunchpadProtocolFromBundle(bundle, opts.chain ?? 'sol');
  if (!protocolId || !LAUNCHPAD_AVATAR_PROTOCOLS.has(protocolId)) return null;

  const brand = protocolBrand(protocolId);
  if (!brand) return null;

  const isMigrated = opts.isMigrated === true;
  const lp = bundle.token.launch_pad?.toLowerCase() ?? '';
  const onBondingCurve =
    !isMigrated &&
    (opts.pumpFunOnBondingCurve === true || isPulseMayhemToken(bundle) || BONDING_LAUNCH_PADS.has(lp));

  /** Thin SVG arc tints — no outer box frame (Axiom-style). */
  const ringStrokeRgba = brandRgba(protocolId, isMigrated ? 0.9 : 0.95);
  const ringStyle: LaunchpadRingStyle =
    protocolId === 'raydium'
      ? 'raydium-gradient'
      : protocolId === 'printr'
        ? 'printr-gradient'
        : protocolId === 'jupiter-studio'
          ? 'jupiter-studio-gradient'
          : protocolId === 'meteora'
            ? 'meteora-gradient'
            : 'solid';
  const cornerTitle = brand.tooltip ?? brand.label;

  return {
    protocolId,
    frameRgba: 'transparent',
    ringStrokeRgba,
    ringStyle,
    cornerLogo: cornerLogoFor(protocolId),
    cornerTitle,
    cornerHref: externalHref(protocolId, bundle.token.mint),
    showBondingProgress: onBondingCurve,
  };
}

/** @deprecated Avatar rings no longer use box-shadow frames. */
export function launchpadFrameShadow(_frameRgba: string): string {
  return 'none';
}

/** Token header / detail — always try to surface launchpad chrome when possible. */
export function resolveLaunchpadAvatarChromeWithFallback(
  bundle: PulseTokenBundle,
  opts: {
    showFrame?: boolean;
    isMigrated?: boolean;
    pumpFunOnBondingCurve?: boolean;
    chain?: AppChainId;
  },
): LaunchpadAvatarChrome | null {
  const chain = opts.chain ?? 'sol';
  const chrome = resolveLaunchpadAvatarChrome(bundle, opts);
  if (chrome) return chrome;

  if (chain !== 'sol') return null;

  const pad =
    bundle.token.launch_pad?.trim() ||
    (bundle.token.mint.toLowerCase().endsWith('pump') ? 'pump.fun' : 'pump.fun');

  return resolveLaunchpadAvatarChrome(
    { ...bundle, token: { ...bundle.token, launch_pad: pad } },
    opts,
  );
}
