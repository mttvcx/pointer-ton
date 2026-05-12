import type { AppChainId } from '@/lib/chains/appChain';

/** What a rule listens for — user toggles per rule in product. */
export type AutomationTriggerType =
  | 'tweet_from_handle'
  | 'contains_contract_address'
  | 'contains_ticker'
  | 'launch_link'
  | 'keywords'
  | 'ai_semantic_intent'
  | 'pulse_visible_token'
  | 'fresh_launch_style';

export type AutomationRuleCategory = 'alert' | 'auto_buy' | 'auto_launch';

export type AutomationExecutionMode = 'alert_only' | 'one_click' | 'auto_buy';

/** Buy path timing — instant favors speed vs pre-check favors safety. */
export type AutomationExecutionTiming = 'instant_then_scan' | 'precheck_then_buy';

/** How deterministic / heuristic risk rails interact with buys. */
export type RiskFilterEvaluationMode = 'strict' | 'warn' | 'instant';

/** When execution fails server-side — surfaced in history UI. */
export type AutomationFailureReason =
  | 'no_token_detected'
  | 'low_confidence'
  | 'risk_filter_blocked'
  | 'insufficient_balance'
  | 'route_failed'
  | 'slippage_failed'
  | 'rpc_failed'
  | 'transaction_expired'
  | 'duplicate_already_bought'
  | 'cooldown_active'
  | 'daily_cap_reached'
  | 'hourly_cap_reached'
  | 'automation_disabled'
  | 'global_kill_switch'
  | 'rule_disabled'
  | 'unknown_error';

/** Per-rule behavior after a failed swap / validation. */
export type RuleFailureHandling =
  | 'retry_once'
  | 'retry_higher_prio_fee'
  | 'alert_only_after_failure'
  | 'disable_rule_after_failures'
  | 'log_only_keep_enabled';

export type AutomationKeywordMatch = 'substring' | 'whole_word';

export interface RiskFilterPrefs {
  minLiquidityUsd: number | null;
  holderCountMin: number | null;
  bundleRugCheck: boolean;
  mintRevoked: boolean;
  freezeRevoked: boolean;
  lpBondingStatusOk: boolean;
  duplicateDetection: boolean;
  deployerBlacklist: boolean;
  knownScamDeployer: boolean;
  honeypotRoutingCheck: boolean;
  maxTaxBps: number | null;
  topHolderConcentrationMax: number | null;
  newDeployerWarning: boolean;
}

export interface AutomationGlobalSettings {
  /** Master automation — default off until user opts in server-side flag + UI toggle. */
  automationEnabledUi: boolean;
  /** Visible emergency stop (UI + eventual server reconcile). */
  killSwitchActive: boolean;
  maxSolPerTrade: number | null;
  maxSolPerDay: number | null;
  maxAutoBuysPerDay: number | null;
  maxOpenAutoBuyPositions: number | null;
  cooldownMsPerHandle: number | null;
  cooldownMsPerToken: number | null;
  stopAfterFailedTxCount: number | null;
  stopDailyLossSol: number | null;
  confirmedAutoBuyConsentAt: string | null;
}

export const DEFAULT_AUTOMATION_GLOBAL_SETTINGS: AutomationGlobalSettings = {
  automationEnabledUi: false,
  killSwitchActive: false,
  maxSolPerTrade: 5,
  maxSolPerDay: 25,
  maxAutoBuysPerDay: 20,
  maxOpenAutoBuyPositions: 12,
  cooldownMsPerHandle: 120_000,
  cooldownMsPerToken: 60_000,
  stopAfterFailedTxCount: 5,
  stopDailyLossSol: null,
  confirmedAutoBuyConsentAt: null,
};

export type AutomationTriggersState = Record<AutomationTriggerType, boolean>;

export const EMPTY_TRIGGER_DEFAULTS: AutomationTriggersState = {
  tweet_from_handle: true,
  contains_contract_address: true,
  contains_ticker: false,
  launch_link: true,
  keywords: false,
  ai_semantic_intent: false,
  pulse_visible_token: false,
  fresh_launch_style: false,
};

export interface AutomationWalletRef {
  kind: 'active_primary' | 'embedded_primary' | 'wallet_id';
  /** When `wallet_id`, matches `user_wallets.id` eventually; until then opaque string. */
  walletId?: string | null;
}

export interface StoredAutomationRule {
  id: string;
  category: AutomationRuleCategory;
  name: string;
  enabled: boolean;
  createdAtIso: string;
  updatedAtIso: string;
  handles: string[];
  chainHint: AppChainId | null;
  triggersEnabled: AutomationTriggersState;
  /** Mode & timing semantics depend on category: alert ignores execution timing. */
  executionMode: AutomationExecutionMode;
  executionTiming: AutomationExecutionTiming;
  riskMode: RiskFilterEvaluationMode;
  failureHandling: RuleFailureHandling;
  buySizeSol: number | null;
  slippageBps: number | null;
  priorityFeeLamports?: number | null;
  maxMarketCapUsd?: number | null;
  minLiquidityUsdRule?: number | null;
  cooldownMs?: number | null;
  maxBuysPerHour?: number | null;
  maxBuysPerDay?: number | null;
  keywords: string[];
  keywordMatch: AutomationKeywordMatch;
  semanticIntentHints: string[];
  /** Fixed mint / CA overrides for “buy this token when keyword hits” workflows. */
  fixedMintCa: string | null;
  tickerSymbol: string | null;
  execWallet: AutomationWalletRef;
  riskPrefs: RiskFilterPrefs;
}

export interface ParsedTweetSignals {
  contracts: string[];
  tickers: string[];
  tokenNamesGuess: string[];
  urls: string[];
  lowered: string[];
  urgencyScore: number;
  scamLikelihoodHint: number;
  launchVerbosityScore: number;
}

export interface TweetIntentClassification {
  bucket: 'token_call' | 'launch_announcement' | 'news_catalyst' | 'kol_signal' | 'irrelevant';
  confidence01: number;
  notes?: string;
}

export interface TweetIngestInput {
  id: string;
  handle: string;
  text: string;
  urls?: string[];
  createdAtIso?: string;
  tweetUrl?: string;
}

export interface MatchedPulseToken {
  mint: string;
  symbol?: string | null;
  /** How we matched Pulse */
  matchedBy: 'contract' | 'ticker_symbol' | 'name_fuzzy';
  score01: number;
}

export interface RuleEvaluationDecision {
  rule: StoredAutomationRule;
  triggersHit: AutomationTriggerType[];
  /** Final buy / alert gate */
  wouldFire: boolean;
  blockedReason: AutomationFailureReason | null;
  alertSummaryLine: string;
  /** Estimated confidence for alerting when CA missing */
  compositeConfidence01: number;
}

export interface AutomationPipelineResult {
  event: TweetIngestInput;
  normalizedHandle: string;
  signals: ParsedTweetSignals;
  classification: TweetIntentClassification;
  pulseHits: MatchedPulseToken[];
  decisions: RuleEvaluationDecision[];
}

export interface AutomationHistoryEntry {
  id: string;
  atIso: string;
  handle: string;
  tweetUrl: string | null;
  tweetSnippet: string;
  detectedMint: string | null;
  triggerTypes: AutomationTriggerType[];
  aiConfidence01: number;
  ruleId: string | null;
  ruleName: string | null;
  category: AutomationRuleCategory | null;
  modeAtFire: AutomationExecutionMode | null;
  actionTaken: 'alert_only' | 'one_click_offer' | 'auto_buy_attempt' | 'blocked' | 'simulation';
  buySolPlanned: number | null;
  txSignature: string | null;
  result: 'ok' | 'failed' | 'skipped';
  failureReason: AutomationFailureReason | null;
  riskFlags: string[];
  intentBucket: TweetIntentClassification['bucket'];
}
