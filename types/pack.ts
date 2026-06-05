export type PackType = 'bronze' | 'silver' | 'gold' | 'legendary';

export type RewardRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type RewardKind =
  | 'token_reward'
  | 'cashback_multiplier'
  | 'points_multiplier'
  | 'rare_access_badge'
  | 'legendary_reward';

export type PackOutcomeSlot = {
  rarity: RewardRarity;
  kind: RewardKind;
  probabilityBps: number;
  /** Token pulls — SOL notional range (variable, not guaranteed). */
  minValueSol?: number;
  maxValueSol?: number;
  /** Token pulls — % of pack price (0.08 = 8% of pack). Preferred in templates. */
  minReturnPctOfPack?: number;
  maxReturnPctOfPack?: number;
  /** Modeled cost for non-token outcomes (% of pack price, e.g. 0.012 = 1.2%). */
  estimatedCostPctOfPack?: number;
  /** Explicit modeled SOL cost override (post-materialization). */
  estimatedCostSol?: number;
  /** Multiplier rewards (e.g. 1.25 = +25% for duration). */
  multiplier?: number;
  /** Badge / access label. */
  badgeLabel?: string;
  /** Card title override. */
  title?: string;
};

export type PackConfig = {
  type: PackType;
  label: string;
  tagline: string;
  packPriceSol: number;
  /** @deprecated Use MODELED_HOUSE_EDGE_MIN_BPS validation; kept for display. */
  targetHouseMarginBps: number;
  minReturnSol: number;
  maxNormalReturnSol: number;
  rareChanceBps: number;
  legendaryChanceBps: number;
  jackpotChanceBps: number;
  maxPayoutSol: number;
  rewardPoolBudgetSol: number;
  /** Max modeled mythic jackpot EV as bps of pack price. */
  jackpotBudgetBps: number;
  enabled: boolean;
  /** Weighted outcome table — probabilities must sum to 10_000 bps. */
  outcomes: PackOutcomeSlot[];
  /** Cards per open (FIFA-style multi-card reveal). */
  cardsPerOpen: number;
};

export type PackReward = {
  id: string;
  rarity: RewardRarity;
  kind: RewardKind;
  title: string;
  subtitle: string;
  displayValue: string;
  valueSol: number | null;
  valueUsd: number | null;
  multiplier: number | null;
  badgeLabel: string | null;
  /** Token pull metadata */
  tokenId?: string | null;
  tokenMint?: string | null;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  tokenIconUrl?: string | null;
  tokenPriceUsd?: number | null;
  marketCapUsd?: number | null;
  amountTokens?: number | null;
};

export type PackOpenResult = {
  openId: string;
  packType: PackType;
  packLabel: string;
  priceSol: number;
  openedAt: string;
  rewards: PackReward[];
  /** Aggregate notional for token pulls only. */
  totalTokenValueSol: number;
  highlightRarity: RewardRarity;
  /** Legendary pack mythic token hit — triggers helicopter sequence. */
  isJackpotPull: boolean;
  /** SOL/USD at open time. */
  solUsd?: number;
  approximateUsd?: number;
  solUsdSource?: 'live' | 'fallback';
  modeledHouseEdgeBps?: number;
  fullOpenEvSol?: number;
};

export type PackEconomicsReport = {
  /** EV of one card roll. */
  perCardEvSol: number;
  /** Modeled EV for all cards in one open. */
  fullOpenEvSol: number;
  /** @deprecated Alias for fullOpenEvSol. */
  expectedValueSol: number;
  houseEdgeSol: number;
  houseEdgeBps: number;
  valid: boolean;
  errors: string[];
};

export type PackOddsRow = {
  rarity: RewardRarity;
  probabilityBps: number;
  probabilityPct: string;
  kinds: RewardKind[];
};

export type PackPublicConfig = Pick<
  PackConfig,
  | 'type'
  | 'label'
  | 'tagline'
  | 'packPriceSol'
  | 'minReturnSol'
  | 'maxNormalReturnSol'
  | 'rareChanceBps'
  | 'legendaryChanceBps'
  | 'jackpotChanceBps'
  | 'maxPayoutSol'
  | 'enabled'
  | 'cardsPerOpen'
> & {
  odds: PackOddsRow[];
  rewardKinds: RewardKind[];
  economics: PackEconomicsReport;
  /** Muted approximate USD (display/debug only). */
  approximateUsd?: number;
  solUsd?: number;
  solUsdSource?: 'live' | 'fallback';
};
