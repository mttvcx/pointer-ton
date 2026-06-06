export type MultiWalletBuyDistribution = 'per_wallet' | 'split_total';

export type MultiWalletBuySettings = {
  /** Each wallet buys the full chip amount, or the chip total is split evenly. */
  distribution: MultiWalletBuyDistribution;
  /** Skip wallets that cannot cover amount + reserve + fees. */
  skipInsufficientBalance: boolean;
  /** Minimum native balance left in each wallet after a buy (SOL / TON). */
  minNativeReserve: number;
  /** Delay between sequential buys when batch execution runs (ms). */
  staggerMs: number;
};

const KEY = 'pointer-multi-wallet-buy-settings-v1';

const defaults: MultiWalletBuySettings = {
  distribution: 'per_wallet',
  skipInsufficientBalance: true,
  minNativeReserve: 0.01,
  staggerMs: 100,
};

export function readMultiWalletBuySettings(): MultiWalletBuySettings {
  if (typeof window === 'undefined') return { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const j = JSON.parse(raw) as Partial<MultiWalletBuySettings>;
    return {
      ...defaults,
      ...j,
      minNativeReserve:
        typeof j.minNativeReserve === 'number' && Number.isFinite(j.minNativeReserve)
          ? Math.max(0, j.minNativeReserve)
          : defaults.minNativeReserve,
      staggerMs:
        typeof j.staggerMs === 'number' && Number.isFinite(j.staggerMs)
          ? Math.max(0, Math.min(2000, Math.round(j.staggerMs)))
          : defaults.staggerMs,
    };
  } catch {
    return { ...defaults };
  }
}

export function persistMultiWalletBuySettings(next: MultiWalletBuySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** How much one wallet should spend for a chip click (batch trading will use this). */
export function perWalletBuyAmount(
  chipAmount: number,
  selectedWalletCount: number,
  settings: MultiWalletBuySettings,
): number {
  if (!Number.isFinite(chipAmount) || chipAmount <= 0 || selectedWalletCount <= 0) return 0;
  if (settings.distribution === 'per_wallet') return chipAmount;
  return chipAmount / selectedWalletCount;
}

export { defaults as defaultMultiWalletBuySettings };
