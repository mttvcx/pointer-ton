import type { AppChainId } from '@/lib/chains/appChain';

/**
 * Deposit / ramp metadata per Pointer app chain.
 * Only list assets Pointer is comfortable referencing in UX — operators should keep this aligned with custody rails.
 *
 * **Onramper network IDs**: must match IDs in Onramper’s “Network support” CSV (lowercase).
 * Confirm in the Onramper partner dashboard before production.
 */
export type FundingAssetChip = {
  symbol: string;
  /** Visual token mark (deterministic tint; no remote icon dependency). */
  swatchClass: string;
};

export type ChainFundingConfig = {
  /** Chain picker label shown in Deposit */
  pickerLabel: string;
  chips: FundingAssetChip[];
  onramper: {
    /** Onramper “Onramper ID” for destination asset (usually lowercase ticker). */
    defaultCryptoId: string;
    /**
     * Comma-separated crypto ids surfaced as “Popular” (see Onramper widget docs).
     * Keep narrow so users stay close to Pointer’s rails.
     */
    popularCryptos: string;
    /** Network filter applied to widget (`onlyCryptoNetworks`). */
    onlyCryptoNetworks: string;
    /** Left side of networkWallets=NETWORK:ADDRESS (must be lowercase). */
    networkWalletsPrefix: string;
  };
};

/** QR / picker accent aligns with Pointer perps cues (not third-party clones). */
const SW = {
  btc: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] bg-gradient-to-br from-[#f7931a] to-[#d97706]',
  sol: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-gradient-to-br from-[#14f195] to-[#0fa674]',
  ton: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-gradient-to-br from-[#9945ff] via-[#5b8dfe] to-[#14f195]',
  bnb: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] bg-gradient-to-br from-[#f0b90b] to-[#c9940c] text-black',
  base: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] bg-gradient-to-br from-[#0052ff] to-[#1e54d6]',
};

export const CHAIN_FUNDING: Record<AppChainId, ChainFundingConfig> = {
  sol: {
    pickerLabel: 'Solana',
    chips: [
      { symbol: 'SOL', swatchClass: SW.sol },
      { symbol: 'USDC', swatchClass: 'bg-[#2775ca]' },
      { symbol: 'USDT', swatchClass: 'bg-emerald-500/95' },
      { symbol: 'PYUSD', swatchClass: 'bg-amber-200/95 text-black' },
      { symbol: 'EURC', swatchClass: 'bg-sky-500/90' },
    ],
    onramper: {
      defaultCryptoId: 'sol',
      popularCryptos: 'sol,usdc',
      /** Onramper list typically uses lowercase network slugs — verify for your tenant. */
      onlyCryptoNetworks: 'solana',
      networkWalletsPrefix: 'solana',
    },
  },
  eth: {
    pickerLabel: 'Ethereum',
    chips: [
      { symbol: 'ETH', swatchClass: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-gradient-to-br from-[#627eea] to-[#3c4a9e]' },
      { symbol: 'WETH', swatchClass: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] bg-gradient-to-br from-[#8b9de8] to-[#627eea]' },
      { symbol: 'USDC', swatchClass: 'bg-[#2775ca]' },
      { symbol: 'USDT', swatchClass: 'bg-emerald-500/95' },
    ],
    onramper: {
      defaultCryptoId: 'eth',
      popularCryptos: 'eth,usdc,usdt',
      onlyCryptoNetworks: 'ethereum',
      networkWalletsPrefix: 'ethereum',
    },
  },
  base: {
    pickerLabel: 'Base',
    chips: [
      { symbol: 'ETH', swatchClass: SW.base },
      { symbol: 'USDC', swatchClass: 'bg-[#2775ca]' },
      { symbol: 'cbBTC', swatchClass: 'bg-orange-500/95' },
    ],
    onramper: {
      defaultCryptoId: 'eth',
      popularCryptos: 'eth,usdc,cbbtc',
      onlyCryptoNetworks: 'base',
      networkWalletsPrefix: 'base',
    },
  },
  robinhood: {
    pickerLabel: 'Robinhood Chain',
    chips: [
      { symbol: 'ETH', swatchClass: SW.base },
      { symbol: 'USDC', swatchClass: 'bg-[#2775ca]' },
    ],
    onramper: {
      defaultCryptoId: 'eth',
      popularCryptos: 'eth,usdc',
      // Robinhood Chain (Arbitrum Orbit, mainnet mid-2026) — Onramper has no network
      // slug for it yet, so the fiat on-ramp shows nothing rather than mis-routing to
      // another chain. Users bridge ETH in (LayerZero / Arbitrum) until an on-ramp lists it.
      onlyCryptoNetworks: 'robinhood',
      networkWalletsPrefix: 'robinhood',
    },
  },
  bnb: {
    pickerLabel: 'BNB Chain',
    chips: [
      { symbol: 'BNB', swatchClass: SW.bnb },
      { symbol: 'USDT', swatchClass: 'bg-emerald-500/95' },
      { symbol: 'USDC', swatchClass: 'bg-[#2775ca]' },
    ],
    onramper: {
      defaultCryptoId: 'bnb',
      popularCryptos: 'bnb,usdt,usdc',
      /** Typical slug — confirm in dashboard (some tenants use binance_smart_chain). */
      onlyCryptoNetworks: 'bsc',
      networkWalletsPrefix: 'bsc',
    },
  },
  ton: {
    pickerLabel: 'TON',
    chips: [
      { symbol: 'TON', swatchClass: SW.ton },
      { symbol: 'USDT', swatchClass: 'bg-emerald-500/95' },
    ],
    onramper: {
      defaultCryptoId: 'ton',
      popularCryptos: 'ton,usdt',
      onlyCryptoNetworks: 'ton',
      networkWalletsPrefix: 'ton',
    },
  },
};

export function fundingForChain(chain: AppChainId): ChainFundingConfig {
  return CHAIN_FUNDING[chain];
}
