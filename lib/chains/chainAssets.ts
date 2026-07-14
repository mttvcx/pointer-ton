import type { AppChainId } from '@/lib/chains/appChain';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';

/**
 * Chain artwork in /public/chains.
 * BTC is the official Bitcoin orange mark (SVG, vector); SOL / BNB / BASE / TON
 * use the official high-res PNGs the team provided (transparent backgrounds).
 */
export const CHAIN_ICON_PNG: Record<AppChainId, string> = {
  sol: '/chains/sol.png',
  eth: '/chains/eth.png',
  bnb: '/chains/bnb.png',
  base: '/chains/base.png',
  robinhood: '/chains/robinhood.svg',
  ton: '/chains/ton.png',
};

/**
 * Bottom-bar Jupiter spot carousel symbols → artwork under `/public/chains`.
 * Falls back to ticker initials in UI when unknown.
 */
export const SPOT_TICKER_ICON_SRC: Record<string, string> = {
  /** Official transparent PNGs — no faux SVG rings. */
  BTC: '/chains/btc.png',
  ETH: '/chains/eth.png',
  SOL: CHAIN_ICON_PNG.sol,
  TON: CHAIN_ICON_PNG.ton,
  BNB: CHAIN_ICON_PNG.bnb,
  BASE: CHAIN_ICON_PNG.base,
};

export function spotTickerIconSrc(symbol: string): string | undefined {
  const k = symbol.trim().toUpperCase();
  return SPOT_TICKER_ICON_SRC[k];
}

/** Bottom-bar spot carousel — all majors, not just BTC · ETH · active native. */
export const SPOT_TICKER_ROTATION = ['BTC', 'ETH', 'SOL', 'BNB', 'TON'] as const;
export type SpotTickerSymbol = (typeof SPOT_TICKER_ROTATION)[number];

export const DEFAULT_SPOT_TICKER_CHAINS: SpotTickerSymbol[] = [...SPOT_TICKER_ROTATION];

/** Keep rotation order; drop unknown symbols; empty = ticker hidden. */
export function normalizeSpotTickerChains(
  chains: readonly string[] | undefined,
): SpotTickerSymbol[] {
  if (!chains?.length) return [];
  const pick = new Set(chains.map((s) => s.trim().toUpperCase()));
  return SPOT_TICKER_ROTATION.filter((sym) => pick.has(sym));
}

/** Put the active header chain's native spot symbol first in the bottom-bar carousel. */
export function spotTickerChainsForActiveChain(
  symbols: readonly SpotTickerSymbol[],
  activeChain: AppChainId,
): SpotTickerSymbol[] {
  if (symbols.length === 0) return [];
  const lead: SpotTickerSymbol =
    activeChain === 'sol'
      ? 'SOL'
      : activeChain === 'ton'
        ? 'TON'
        : activeChain === 'bnb'
          ? 'BNB'
          : 'ETH';
  const rest = symbols.filter((s) => s !== lead);
  return [lead, ...rest];
}

/**
 * Squads + coarse chain slug → raster/SVG logo under `/public/chains`.
 * Keys are lowercase. Missing slugs omit an entry ({@link ChainIcon} returns null).
 */
export const chainLogoSrc: Record<string, string> = {
  sol: '/chains/sol.png',
  solana: '/chains/solana.png',
  ton: '/chains/ton.png',
  base: '/chains/base.png',
  bnb: '/chains/bnb.png',
  hyperliquid: '/chains/hyperliquid.svg',
  ethereum: '/chains/eth.png',
  eth: '/chains/eth.png',
  robinhood: '/chains/robinhood.svg',
};

export const CHAIN_DROPDOWN_LABEL: Record<AppChainId, string> = {
  sol: 'Solana',
  eth: 'Ethereum',
  bnb: 'BNB',
  base: 'Base',
  robinhood: 'Robinhood Chain',
  ton: 'The Open Network',
};

/**
 * Icon for the NATIVE spend token on the buy button (may differ from the chain
 * icon). Robinhood's gas is ETH, so it shows an ETH mark badged with the
 * Robinhood feather — not the plain chain feather. Falls back to the chain icon.
 */
const NATIVE_SPEND_ICON: Partial<Record<AppChainId, string>> = {
  // Robinhood's gas token is ETH — the spend/balance/amount icon is the ETH diamond
  // badged with the Robinhood leaf (user-supplied). The chain SELECTOR stays leaf-only.
  robinhood: '/chains/eth-robinhood-v2.svg',
};
export function nativeSpendIconSrc(chain: AppChainId): string {
  return NATIVE_SPEND_ICON[chain] ?? CHAIN_ICON_PNG[chain];
}

export const CHAIN_TICKER: Record<AppChainId, string> = {
  sol: 'SOL',
  eth: 'ETH',
  bnb: 'BNB',
  base: 'BASE',
  // Robinhood Chain's gas token is ETH (Arbitrum Orbit L2) — balances/amounts show ETH.
  robinhood: 'ETH',
  ton: 'TON',
};

/**
 * Ticker shown in the CHAIN SELECTOR only (top pill + dropdown rows). Robinhood
 * is branded 'HOOD' here for identity, even though its gas token is ETH — balance
 * and native-amount labels still use {@link CHAIN_TICKER} (the real ETH gas token).
 */
export const CHAIN_SELECTOR_TICKER: Record<AppChainId, string> = {
  ...CHAIN_TICKER,
  robinhood: 'HOOD',
};

export const ORDERED_CHAINS: AppChainId[] = [...APP_CHAIN_IDS];

/**
 * Points ecosystem strip — same artwork as the header chain dropdown ({@link CHAIN_ICON_PNG}).
 * Hyperliquid is not in {@link AppChainId}; add `/public/chains/hyperliquid.png` (optional fallback in UI).
 */
export const POINTS_ECOSYSTEM_CHAIN_ICON = {
  sol: CHAIN_ICON_PNG.sol,
  eth: CHAIN_ICON_PNG.eth,
  ton: CHAIN_ICON_PNG.ton,
  base: CHAIN_ICON_PNG.base,
  bnb: CHAIN_ICON_PNG.bnb,
  /** Not in AppChainId; bundled vector (other chains use same PNGs as the header dropdown). */
  hyperliquid: '/chains/hyperliquid.svg',
} as const;

export type PointsEcosystemIconId = keyof typeof POINTS_ECOSYSTEM_CHAIN_ICON;
