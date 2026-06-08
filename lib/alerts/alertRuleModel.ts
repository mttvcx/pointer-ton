import { z } from 'zod';
import { migrateLegacyPulseProtocols } from '@/lib/tokens/columnPresetModel';
import { ALL_PULSE_PROTOCOL_FILTER_IDS } from '@/lib/tokens/pulseProtocolRegistry';

export const ALERT_RULE_TYPES = ['pulse_launchpad', 'sol_twitter_listen', 'automation'] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

export const ALERT_TYPE_ALERT_RULE = 'alert_rule' as const;
export const ALERT_TYPE_TWITTER_LISTEN = 'twitter_listen' as const;

const PROTOCOL_FILTER_ENUM = ALL_PULSE_PROTOCOL_FILTER_IDS as unknown as [string, ...string[]];

export const PulseLaunchpadRuleConfigSchema = z
  .object({
    launchpads: z.array(z.enum(PROTOCOL_FILTER_ENUM)).optional(),
    minInitialLiquiditySol: z.number().nonnegative().nullable().optional(),
  })
  .strict();

export type PulseLaunchpadRuleConfig = z.infer<typeof PulseLaunchpadRuleConfigSchema>;

export const TWEET_IMAGE_MINT_MODES = ['off', 'smart', 'prefer_media'] as const;
export type TweetImageMintMode = (typeof TWEET_IMAGE_MINT_MODES)[number];

export const SolTwitterListenRuleConfigSchema = z
  .object({
    handles: z.array(z.string().trim().min(1).max(72)).min(1).max(64),
    phrases: z.array(z.string().trim().min(1).max(200)).max(64),
    phraseMatch: z.enum(['substring', 'whole_word']).optional(),
    execution: z.enum(['notify', 'auto_buy', 'auto_launch']).optional(),
    launchMode: z.enum(['manual', 'ai']).optional(),
    launchBuySol: z.number().positive().max(420).nullable().optional(),
    tweetImageMintMode: z.enum(TWEET_IMAGE_MINT_MODES).optional(),
    openWithTweetMedia: z.boolean().optional(),
    buySolPreset: z.number().positive().max(420).nullable().optional(),
    maxSolPerDay: z.number().positive().max(1_000_000).nullable().optional(),
    slippageBps: z.number().int().min(50).max(5000).nullable().optional(),
  })
  .strict();

export type SolTwitterListenRuleConfig = z.infer<typeof SolTwitterListenRuleConfigSchema>;

export function parseSolTwitterListenRuleConfig(raw: unknown): SolTwitterListenRuleConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const o: Record<string, unknown> = { ...src };
  if (!Array.isArray(o.handles)) o.handles = [];
  else o.handles = (o.handles as unknown[]).map((x) => String(x).trim()).filter(Boolean);
  if (!Array.isArray(o.phrases)) o.phrases = [];
  else o.phrases = (o.phrases as unknown[]).map((x) => String(x).trim()).filter(Boolean);

  const p = SolTwitterListenRuleConfigSchema.safeParse(o);
  return p.success ? p.data : null;
}

export function parsePulseLaunchpadRuleConfig(raw: unknown): PulseLaunchpadRuleConfig | null {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (Array.isArray(o.launchpads)) {
    const migrated = migrateLegacyPulseProtocols(o.launchpads);
    if (migrated?.length) o.launchpads = migrated;
    else o.launchpads = [];
  }
  const p = PulseLaunchpadRuleConfigSchema.safeParse(o);
  return p.success ? p.data : null;
}

/** @deprecated use {@link alertProtocolFilterMatches} from lib/protocol/alertProtocolMatch */
export function launchpadFilterMatchesProtocols(
  launchPad: string | null,
  filter: string[] | undefined,
  padToProtocols: (pad: string | null) => string[],
): boolean {
  if (!filter || filter.length === 0) return true;
  const detected = new Set(padToProtocols(launchPad));
  return filter.some((f) => detected.has(f));
}
