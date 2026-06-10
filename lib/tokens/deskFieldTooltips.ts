/** Honest tooltips for desk fields that are not yet indexed. */
export const DESK_FIELD_TOOLTIPS = {
  solBalance: 'Requires SOL balance enrichment (RPC).',
  funding: 'Requires funding graph ingest for this wallet.',
  held: 'Requires holder history from first indexed buy.',
  bought: 'No indexed buys for this wallet on this mint.',
  sold: 'No indexed sells for this wallet on this mint.',
  uPnl: 'Requires buy/sell history to estimate spot PnL.',
  remaining: 'Supply % from holder snapshot; USD needs indexed cost basis.',
  snipers: 'Requires sniper detection from launch-window trades.',
  bundlers: 'Requires bundler detection from launch bundle analysis.',
  insiders: 'Requires insider wallet graph.',
  lpBurned: 'Requires LP burn verification on-chain.',
  dexPaid: 'DEX listing fee status from pump.fun / DEX metadata.',
  fees: 'Requires global fee accounting from chain indexer.',
  bonding: 'Requires bonding curve progress from launchpad API.',
  ath: 'Requires price history for all-time high.',
  pros: 'Requires pro-trader classification.',
  supply: 'Supply from token metadata; refresh to update.',
  liquidity: 'Liquidity from market snapshot; refresh to update.',
  lockedVault: 'Locked vault — trade stats are not shown for system accounts.',
  lpPool: 'Liquidity pool — holds LP tokens, not trader PnL.',
} as const;

export type DeskFieldTooltipKey = keyof typeof DESK_FIELD_TOOLTIPS;
