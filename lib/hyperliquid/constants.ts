export const HYPERLIQUID_INFO_URL =
  process.env.HYPERLIQUID_INFO_URL?.trim() || 'https://api.hyperliquid.xyz/info';

/** Quick-switch strip — always shown when available */
export const PERPS_PINNED_COINS = ['BTC', 'ETH', 'SOL'] as const;
