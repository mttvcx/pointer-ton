export type AutoSellTokenScope =
  | { kind: 'mint'; mint: string }
  | { kind: 'all_held' };

export type AutoSellTrigger =
  | { type: 'mc_milestone'; targetMcUsd: number }
  | { type: 'pct_gain'; gainPct: number }
  | { type: 'time_elapsed'; minutes: number }
  | { type: 'stop_loss_mc'; mcUsd: number }
  /** Trailing stop: the stop rises with the peak; sell when price drops `trailPct` below the highest seen. */
  | { type: 'trailing_stop'; trailPct: number };

/** Wallet routing — only primary is supported in v1. */
export type AutoSellWalletScope = 'primary';

export type AutoSellRule = {
  id: string;
  enabled: boolean;
  name: string;
  tokenScope: AutoSellTokenScope;
  trigger: AutoSellTrigger;
  /** 1–100 percent of wallet balance for this mint. */
  sellPct: number;
  walletScope: AutoSellWalletScope;
};

export const DEFAULT_AUTO_SELL_RULE: Omit<AutoSellRule, 'id'> = {
  enabled: true,
  name: 'Take profit',
  tokenScope: { kind: 'all_held' },
  trigger: { type: 'pct_gain', gainPct: 50 },
  sellPct: 25,
  walletScope: 'primary',
};

export type AutoSellPrefs = {
  autoSellEnabled: boolean;
  rules: AutoSellRule[];
  /** Minimum seconds between firings of the same rule on the same mint. */
  cooldownSec: number;
};

export const DEFAULT_AUTO_SELL_PREFS: AutoSellPrefs = {
  autoSellEnabled: false,
  rules: [],
  cooldownSec: 60,
};
