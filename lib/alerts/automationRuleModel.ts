import { z } from 'zod';
import type { Tables } from '@/lib/supabase/types';
import {
  parseSolTwitterListenRuleConfig,
  type SolTwitterListenRuleConfig,
  TWEET_IMAGE_MINT_MODES,
} from '@/lib/alerts/alertRuleModel';
import {
  hammingThresholdFromPreset,
  type HammingThresholdPreset as HashPreset,
} from '@/lib/image/perceptualHash';

export const AUTOMATION_RULE_TYPE = 'automation' as const;

export const AUTOMATION_TRIGGER_TYPES = [
  'keyword',
  'ca_detected',
  'image_match',
  'interaction',
  'pfp_change',
  'banner_change',
  'mc_milestone',
  'time_elapsed',
  // Unified into alert_rules so mobile binds one schema/one endpoint for all triggers.
  // Fired by the wallet-poll cron (tracked_wallet) and limit/price cron (price).
  'tracked_wallet',
  'price',
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = ['buy', 'sell', 'notify', 'deploy'] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const ActivityFilterSchema = z
  .object({
    tweets: z.boolean().default(true),
    replies: z.boolean().default(true),
    quotes: z.boolean().default(true),
    retweets: z.boolean().default(true),
  })
  .strict();
export type ActivityFilter = z.infer<typeof ActivityFilterSchema>;

export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
  tweets: true,
  replies: true,
  quotes: true,
  retweets: true,
};

// min(0): a keyword/CA rule may carry no explicit handles — empty = watch the
// default monitor set (DEFAULT_MONITOR_HANDLES) once the engine wires it.
const handlesSchema = z.array(z.string().trim().min(1).max(72)).max(64);

export const KeywordTriggerConfigSchema = z
  .object({
    handles: handlesSchema,
    phrases: z.array(z.string().trim().min(1).max(200)).max(64),
    phraseMatch: z.enum(['substring', 'whole_word']).optional(),
  })
  .strict();

export const CaDetectedTriggerConfigSchema = z
  .object({
    handles: handlesSchema,
    tweetImageMintMode: z.enum(TWEET_IMAGE_MINT_MODES).optional(),
  })
  .strict();

export const HAMMING_THRESHOLD_PRESETS = ['strict', 'normal', 'loose'] as const;
export type HammingThresholdPreset = (typeof HAMMING_THRESHOLD_PRESETS)[number];

export const ImageMatchTriggerConfigSchema = z
  .object({
    handles: handlesSchema,
    /** 64-bit dHash hex (16 chars) from reference image upload. */
    targetImageHash: z.string().regex(/^[0-9a-f]{16}$/i),
    hammingThreshold: z.number().int().min(0).max(32).optional(),
    thresholdPreset: z.enum(HAMMING_THRESHOLD_PRESETS).optional(),
    tweetImageMintMode: z.enum(TWEET_IMAGE_MINT_MODES).optional(),
    openWithTweetMedia: z.boolean().optional(),
  })
  .strict();

export const InteractionTriggerConfigSchema = z
  .object({
    handles: handlesSchema,
    /** e.g. reply, quote, mention — matched against ingest `tweetKind` when present */
    kinds: z.array(z.enum(['reply', 'quote', 'mention', 'retweet'])).min(1).optional(),
  })
  .strict();

export const ProfileChangeTriggerConfigSchema = z
  .object({
    handles: handlesSchema,
  })
  .strict();

export const McMilestoneTriggerConfigSchema = z
  .object({
    mint: z.string().trim().min(20).max(64).optional(),
    targetMcUsd: z.number().positive().max(1_000_000_000),
  })
  .strict();

export const TimeElapsedTriggerConfigSchema = z
  .object({
    mint: z.string().trim().min(20).max(64).optional(),
    minutes: z.number().int().min(1).max(60 * 24 * 30),
  })
  .strict();

/** Fires when a watched wallet trades. Wallet must also be in `tracked_wallets` for the poll cron to see it. */
export const TrackedWalletTriggerConfigSchema = z
  .object({
    wallet: z.string().trim().min(32).max(64),
    /** default 'buy' */
    side: z.enum(['buy', 'sell', 'any']).optional(),
    /** ignore trades smaller than this many SOL */
    minSolAmount: z.number().nonnegative().max(100_000).optional(),
  })
  .strict();

/** Fires when a token's price crosses an absolute target or an Nx multiple of its base price. */
export const PriceTriggerConfigSchema = z
  .object({
    mint: z.string().trim().min(20).max(64),
    /** default 'above' */
    direction: z.enum(['above', 'below']).optional(),
    targetPriceUsd: z.number().positive().optional(),
    /** e.g. 2 = 2x from the base price captured when the rule was created */
    targetMultiple: z.number().positive().max(10_000).optional(),
    basePriceUsd: z.number().positive().optional(),
  })
  .strict()
  .refine((v) => v.targetPriceUsd != null || v.targetMultiple != null, {
    message: 'price trigger requires targetPriceUsd or targetMultiple',
  });

export const BuyActionConfigSchema = z
  .object({
    buySolPreset: z.number().positive().max(420).nullable().optional(),
    slippageBps: z.number().int().min(50).max(5000).nullable().optional(),
    /** Chain the auto-buy executes on (multi-chain). Lives here — it's an action property. */
    chain: z.enum(['sol', 'eth', 'base', 'bnb']).optional(),
  })
  .strict();

export const SellActionConfigSchema = z
  .object({
    sellPct: z.number().min(1).max(100).optional(),
  })
  .strict();

export const NotifyActionConfigSchema = z
  .object({
    openWithTweetMedia: z.boolean().optional(),
    tweetImageMintMode: z.enum(TWEET_IMAGE_MINT_MODES).optional(),
  })
  .strict();

export const DeployActionConfigSchema = z
  .object({
    launchMode: z.enum(['manual', 'ai']).optional(),
    launchBuySol: z.number().positive().max(420).nullable().optional(),
  })
  .strict();

export type KeywordTriggerConfig = z.infer<typeof KeywordTriggerConfigSchema>;
export type CaDetectedTriggerConfig = z.infer<typeof CaDetectedTriggerConfigSchema>;
export type ImageMatchTriggerConfig = z.infer<typeof ImageMatchTriggerConfigSchema>;
export type InteractionTriggerConfig = z.infer<typeof InteractionTriggerConfigSchema>;
export type ProfileChangeTriggerConfig = z.infer<typeof ProfileChangeTriggerConfigSchema>;
export type McMilestoneTriggerConfig = z.infer<typeof McMilestoneTriggerConfigSchema>;
export type TimeElapsedTriggerConfig = z.infer<typeof TimeElapsedTriggerConfigSchema>;
export type TrackedWalletTriggerConfig = z.infer<typeof TrackedWalletTriggerConfigSchema>;
export type PriceTriggerConfig = z.infer<typeof PriceTriggerConfigSchema>;

export type AutomationTriggerConfig =
  | KeywordTriggerConfig
  | CaDetectedTriggerConfig
  | ImageMatchTriggerConfig
  | InteractionTriggerConfig
  | ProfileChangeTriggerConfig
  | McMilestoneTriggerConfig
  | TimeElapsedTriggerConfig
  | TrackedWalletTriggerConfig
  | PriceTriggerConfig;

export type AutomationActionConfig =
  | z.infer<typeof BuyActionConfigSchema>
  | z.infer<typeof SellActionConfigSchema>
  | z.infer<typeof NotifyActionConfigSchema>
  | z.infer<typeof DeployActionConfigSchema>;

export const AutomationRuleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    triggerType: z.enum(AUTOMATION_TRIGGER_TYPES),
    triggerConfig: z.unknown(),
    actionType: z.enum(AUTOMATION_ACTION_TYPES),
    actionConfig: z.unknown(),
    activityFilter: ActivityFilterSchema.optional(),
    disableAfterSuccess: z.boolean().optional(),
    cooldownSeconds: z.number().int().min(0).max(86_400).optional(),
    dailyCapSol: z.number().positive().max(1_000_000).nullable().optional(),
    flashEnabled: z.boolean().optional(),
    flashColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    flashSize: z.enum(['normal', 'large']).optional(),
    audioEnabled: z.boolean().optional(),
    audioUrl: z.string().url().nullable().optional(),
    audioPreset: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type AutomationRuleBody = z.infer<typeof AutomationRuleBodySchema>;

/** Normalized rule used by ingest + UI (legacy rows converted on read). */
export type AutomationRule = {
  id: string;
  userId: string;
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  actionType: AutomationActionType;
  actionConfig: AutomationActionConfig;
  activityFilter: ActivityFilter;
  disableAfterSuccess: boolean;
  cooldownSeconds: number;
  dailyCapSol: number | null;
  flashEnabled: boolean;
  flashColor: string;
  flashSize: string;
  audioEnabled: boolean;
  audioUrl: string | null;
  audioPreset: string;
  isActive: boolean;
  createdAt: string;
  /** True when row was synthesized from legacy `sol_twitter_listen`. */
  legacyTwitterListen?: boolean;
};

export type AlertRuleRow = Tables<'alert_rules'>;

function parseTriggerConfig(
  type: AutomationTriggerType,
  raw: unknown,
): AutomationTriggerConfig | null {
  switch (type) {
    case 'keyword':
      return KeywordTriggerConfigSchema.safeParse(raw).success
        ? KeywordTriggerConfigSchema.parse(raw)
        : null;
    case 'ca_detected':
      return CaDetectedTriggerConfigSchema.safeParse(raw).success
        ? CaDetectedTriggerConfigSchema.parse(raw)
        : null;
    case 'image_match':
      return ImageMatchTriggerConfigSchema.safeParse(raw).success
        ? ImageMatchTriggerConfigSchema.parse(raw)
        : null;
    case 'interaction':
      return InteractionTriggerConfigSchema.safeParse(raw).success
        ? InteractionTriggerConfigSchema.parse(raw)
        : null;
    case 'pfp_change':
    case 'banner_change':
      return ProfileChangeTriggerConfigSchema.safeParse(raw).success
        ? ProfileChangeTriggerConfigSchema.parse(raw)
        : null;
    case 'mc_milestone':
      return McMilestoneTriggerConfigSchema.safeParse(raw).success
        ? McMilestoneTriggerConfigSchema.parse(raw)
        : null;
    case 'time_elapsed':
      return TimeElapsedTriggerConfigSchema.safeParse(raw).success
        ? TimeElapsedTriggerConfigSchema.parse(raw)
        : null;
    case 'tracked_wallet':
      return TrackedWalletTriggerConfigSchema.safeParse(raw).success
        ? TrackedWalletTriggerConfigSchema.parse(raw)
        : null;
    case 'price':
      return PriceTriggerConfigSchema.safeParse(raw).success
        ? PriceTriggerConfigSchema.parse(raw)
        : null;
    default:
      return null;
  }
}

function parseActionConfig(type: AutomationActionType, raw: unknown): AutomationActionConfig | null {
  switch (type) {
    case 'buy':
      return BuyActionConfigSchema.safeParse(raw).success ? BuyActionConfigSchema.parse(raw) : null;
    case 'sell':
      return SellActionConfigSchema.safeParse(raw).success ? SellActionConfigSchema.parse(raw) : null;
    case 'notify':
      return NotifyActionConfigSchema.safeParse(raw).success
        ? NotifyActionConfigSchema.parse(raw)
        : null;
    case 'deploy':
      return DeployActionConfigSchema.safeParse(raw).success
        ? DeployActionConfigSchema.parse(raw)
        : null;
    default:
      return null;
  }
}

export function validateAutomationRuleBody(body: AutomationRuleBody): {
  triggerConfig: AutomationTriggerConfig;
  actionConfig: AutomationActionConfig;
  activityFilter: ActivityFilter;
} | null {
  const triggerConfig = parseTriggerConfig(body.triggerType, body.triggerConfig);
  const actionConfig = parseActionConfig(body.actionType, body.actionConfig);
  if (!triggerConfig || !actionConfig) return null;
  const activityFilter = body.activityFilter
    ? ActivityFilterSchema.safeParse(body.activityFilter).success
      ? ActivityFilterSchema.parse(body.activityFilter)
      : null
    : DEFAULT_ACTIVITY_FILTER;
  if (!activityFilter) return null;
  return { triggerConfig, actionConfig, activityFilter };
}

/** Map legacy twitter listen config → automation model. */
export function migrateSolTwitterListenToAutomation(
  cfg: SolTwitterListenRuleConfig,
): Pick<
  AutomationRule,
  'triggerType' | 'triggerConfig' | 'actionType' | 'actionConfig' | 'activityFilter' | 'dailyCapSol'
> {
  const execution = cfg.execution ?? 'notify';
  let actionType: AutomationActionType = 'notify';
  if (execution === 'auto_buy') actionType = 'buy';
  else if (execution === 'auto_launch') actionType = 'deploy';

  const imageMode = cfg.tweetImageMintMode ?? 'smart';
  const hasPhrases = cfg.phrases.length > 0;

  let triggerType: AutomationTriggerType;
  let triggerConfig: AutomationTriggerConfig;

  if (hasPhrases) {
    triggerType = 'keyword';
    triggerConfig = {
      handles: cfg.handles,
      phrases: cfg.phrases,
      phraseMatch: cfg.phraseMatch,
    };
  } else if (imageMode === 'prefer_media' || imageMode === 'smart') {
    triggerType = 'image_match';
    triggerConfig = {
      handles: cfg.handles,
      tweetImageMintMode: imageMode,
      openWithTweetMedia: cfg.openWithTweetMedia,
    };
  } else {
    triggerType = 'ca_detected';
    triggerConfig = {
      handles: cfg.handles,
      tweetImageMintMode: imageMode,
    };
  }

  let actionConfig: AutomationActionConfig = {};
  if (actionType === 'buy') {
    actionConfig = {
      buySolPreset: cfg.buySolPreset ?? null,
      slippageBps: cfg.slippageBps ?? null,
    };
  } else if (actionType === 'notify') {
    actionConfig = {
      openWithTweetMedia: cfg.openWithTweetMedia,
      tweetImageMintMode: imageMode,
    };
  } else if (actionType === 'deploy') {
    actionConfig = {
      launchMode: cfg.launchMode,
      launchBuySol: cfg.launchBuySol ?? null,
    };
  }

  return {
    triggerType,
    triggerConfig,
    actionType,
    actionConfig,
    activityFilter: DEFAULT_ACTIVITY_FILTER,
    dailyCapSol: cfg.maxSolPerDay ?? null,
  };
}

function readAutomationColumns(row: AlertRuleRow): Partial<AutomationRule> | null {
  const r = row as AlertRuleRow & {
    trigger_type?: string | null;
    trigger_config?: unknown;
    action_type?: string | null;
    action_config?: unknown;
    activity_filter?: unknown;
    disable_after_success?: boolean | null;
    cooldown_seconds?: number | null;
    daily_cap_sol?: number | null;
  };

  if (!r.trigger_type || !r.action_type) return null;

  const triggerType = r.trigger_type as AutomationTriggerType;
  const actionType = r.action_type as AutomationActionType;
  if (!AUTOMATION_TRIGGER_TYPES.includes(triggerType)) return null;
  if (!AUTOMATION_ACTION_TYPES.includes(actionType)) return null;

  const triggerConfig = parseTriggerConfig(triggerType, r.trigger_config);
  const actionConfig = parseActionConfig(actionType, r.action_config);
  if (!triggerConfig || !actionConfig) return null;

  const activityParsed = ActivityFilterSchema.safeParse(r.activity_filter ?? DEFAULT_ACTIVITY_FILTER);
  const activityFilter = activityParsed.success ? activityParsed.data : DEFAULT_ACTIVITY_FILTER;

  return {
    triggerType,
    triggerConfig,
    actionType,
    actionConfig,
    activityFilter,
    disableAfterSuccess: Boolean(r.disable_after_success),
    cooldownSeconds:
      r.cooldown_seconds != null && Number.isFinite(r.cooldown_seconds)
        ? Math.max(0, Math.floor(r.cooldown_seconds))
        : 0,
    dailyCapSol:
      r.daily_cap_sol != null && Number.isFinite(r.daily_cap_sol) ? r.daily_cap_sol : null,
  };
}

export function parseAutomationRuleFromRow(row: AlertRuleRow): AutomationRule | null {
  const fromCols = readAutomationColumns(row);
  if (fromCols?.triggerType && fromCols.triggerConfig && fromCols.actionType && fromCols.actionConfig) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      triggerType: fromCols.triggerType,
      triggerConfig: fromCols.triggerConfig,
      actionType: fromCols.actionType,
      actionConfig: fromCols.actionConfig,
      activityFilter: fromCols.activityFilter ?? DEFAULT_ACTIVITY_FILTER,
      disableAfterSuccess: fromCols.disableAfterSuccess ?? false,
      cooldownSeconds: fromCols.cooldownSeconds ?? 0,
      dailyCapSol: fromCols.dailyCapSol ?? null,
      flashEnabled: row.flash_enabled,
      flashColor: row.flash_color,
      flashSize: row.flash_size,
      audioEnabled: row.audio_enabled,
      audioUrl: row.audio_url,
      audioPreset: row.audio_preset,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  if (row.rule_type !== 'sol_twitter_listen') return null;
  const legacy = parseSolTwitterListenRuleConfig(row.rule_config);
  if (!legacy) return null;
  const migrated = migrateSolTwitterListenToAutomation(legacy);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    ...migrated,
    disableAfterSuccess: false,
    cooldownSeconds: 0,
    flashEnabled: row.flash_enabled,
    flashColor: row.flash_color,
    flashSize: row.flash_size,
    audioEnabled: row.audio_enabled,
    audioUrl: row.audio_url,
    audioPreset: row.audio_preset,
    isActive: row.is_active,
    createdAt: row.created_at,
    legacyTwitterListen: true,
  };
}

/** Twitter listen execution view derived from automation rule. */
export type TwitterListenExecutionView = {
  ruleId: string;
  ruleName: string;
  userId: string;
  triggerType: AutomationTriggerType;
  handles: string[];
  phrases: string[];
  phraseMatch: 'substring' | 'whole_word';
  targetImageHash: string | null;
  hammingThreshold: number;
  execution: 'notify' | 'auto_buy' | 'auto_launch';
  tweetImageMintMode: SolTwitterListenRuleConfig['tweetImageMintMode'];
  openWithTweetMedia: boolean;
  buySolPreset: number | null;
  maxSolPerDay: number | null;
  slippageBps: number | null;
  activityFilter: ActivityFilter;
  disableAfterSuccess: boolean;
  cooldownSeconds: number;
  flashEnabled: boolean;
  flashColor: string;
  flashSize: string;
  audioEnabled: boolean;
  audioUrl: string | null;
  audioPreset: string;
};

export function twitterListenViewFromAutomation(rule: AutomationRule): TwitterListenExecutionView | null {
  const twitterTriggers: AutomationTriggerType[] = [
    'keyword',
    'ca_detected',
    'image_match',
    'interaction',
    'pfp_change',
    'banner_change',
  ];
  if (!twitterTriggers.includes(rule.triggerType)) return null;

  const handles = 'handles' in rule.triggerConfig ? rule.triggerConfig.handles : [];
  if (handles.length === 0) return null;

  let phrases: string[] = [];
  let phraseMatch: 'substring' | 'whole_word' = 'substring';
  let targetImageHash: string | null = null;
  let hammingThreshold = 8;
  if (rule.triggerType === 'keyword' && 'phrases' in rule.triggerConfig) {
    phrases = rule.triggerConfig.phrases;
    phraseMatch = rule.triggerConfig.phraseMatch ?? 'substring';
  }
  if (rule.triggerType === 'image_match') {
    const tc = rule.triggerConfig as ImageMatchTriggerConfig;
    targetImageHash = tc.targetImageHash.toLowerCase();
    hammingThreshold =
      tc.hammingThreshold ??
      hammingThresholdFromPreset(tc.thresholdPreset as HashPreset | undefined);
  }

  let tweetImageMintMode: SolTwitterListenRuleConfig['tweetImageMintMode'] = 'smart';
  let openWithTweetMedia = true;
  if (rule.triggerType === 'image_match') {
    const tc = rule.triggerConfig as ImageMatchTriggerConfig;
    tweetImageMintMode = tc.tweetImageMintMode ?? 'smart';
    openWithTweetMedia = tc.openWithTweetMedia ?? true;
  } else if (rule.triggerType === 'ca_detected' && 'tweetImageMintMode' in rule.triggerConfig) {
    tweetImageMintMode = rule.triggerConfig.tweetImageMintMode ?? 'off';
    openWithTweetMedia = false;
  }

  if (rule.actionType === 'notify' && 'openWithTweetMedia' in rule.actionConfig) {
    openWithTweetMedia = rule.actionConfig.openWithTweetMedia ?? openWithTweetMedia;
    if ('tweetImageMintMode' in rule.actionConfig && rule.actionConfig.tweetImageMintMode) {
      tweetImageMintMode = rule.actionConfig.tweetImageMintMode;
    }
  }

  let execution: 'notify' | 'auto_buy' | 'auto_launch' = 'notify';
  if (rule.actionType === 'buy') execution = 'auto_buy';
  else if (rule.actionType === 'deploy') execution = 'auto_launch';

  const buySolPreset =
    rule.actionType === 'buy' && 'buySolPreset' in rule.actionConfig
      ? (rule.actionConfig.buySolPreset ?? null)
      : null;
  const slippageBps =
    rule.actionType === 'buy' && 'slippageBps' in rule.actionConfig
      ? (rule.actionConfig.slippageBps ?? null)
      : null;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    userId: rule.userId,
    triggerType: rule.triggerType,
    handles,
    phrases,
    phraseMatch,
    targetImageHash,
    hammingThreshold,
    execution,
    tweetImageMintMode,
    openWithTweetMedia,
    buySolPreset,
    maxSolPerDay: rule.dailyCapSol,
    slippageBps,
    activityFilter: rule.activityFilter,
    disableAfterSuccess: rule.disableAfterSuccess,
    cooldownSeconds: rule.cooldownSeconds,
    flashEnabled: rule.flashEnabled,
    flashColor: rule.flashColor,
    flashSize: rule.flashSize,
    audioEnabled: rule.audioEnabled,
    audioUrl: rule.audioUrl,
    audioPreset: rule.audioPreset,
  };
}

export function automationRuleToDto(row: AlertRuleRow) {
  const parsed = parseAutomationRuleFromRow(row);
  return {
    id: row.id,
    name: row.name,
    ruleType: row.rule_type,
    ruleConfig: row.rule_config,
    triggerType: parsed?.triggerType ?? null,
    triggerConfig: parsed?.triggerConfig ?? null,
    actionType: parsed?.actionType ?? null,
    actionConfig: parsed?.actionConfig ?? null,
    activityFilter: parsed?.activityFilter ?? DEFAULT_ACTIVITY_FILTER,
    disableAfterSuccess: parsed?.disableAfterSuccess ?? false,
    cooldownSeconds: parsed?.cooldownSeconds ?? 0,
    dailyCapSol: parsed?.dailyCapSol ?? null,
    flashEnabled: row.flash_enabled,
    flashColor: row.flash_color,
    flashSize: row.flash_size,
    audioEnabled: row.audio_enabled,
    audioUrl: row.audio_url,
    audioPreset: row.audio_preset,
    isActive: row.is_active,
    createdAt: row.created_at,
    legacyTwitterListen: parsed?.legacyTwitterListen ?? false,
  };
}

export function triggerTypeLabel(t: AutomationTriggerType): string {
  const labels: Record<AutomationTriggerType, string> = {
    keyword: 'Keyword match',
    ca_detected: 'CA detected in post',
    image_match: 'Image match (perceptual hash)',
    interaction: 'Interaction',
    pfp_change: 'Profile picture change',
    banner_change: 'Banner change',
    mc_milestone: 'MC milestone',
    time_elapsed: 'Time elapsed',
    tracked_wallet: 'Tracked wallet trades',
    price: 'Price target',
  };
  return labels[t];
}

export function actionTypeLabel(t: AutomationActionType): string {
  const labels: Record<AutomationActionType, string> = {
    buy: 'Auto-buy',
    sell: 'Auto-sell',
    notify: 'Notify only',
    deploy: 'Auto-launch',
  };
  return labels[t];
}
