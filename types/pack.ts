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
  targetHouseMarginBps: number;
  minReturnSol: number;
  maxNormalReturnSol: number;
  rareChanceBps: number;
  legendaryChanceBps: number;
  jackpotChanceBps: number;
  maxPayoutSol: number;
  rewardPoolBudgetSol: number;
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
};

export type PackEconomicsReport = {
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
};
