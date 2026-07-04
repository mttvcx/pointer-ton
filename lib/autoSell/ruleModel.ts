import { z } from 'zod';

/**
 * Server-side auto-sell rule model — the per-account, synced counterpart to the
 * browser-only `store/autoSell.ts`. Persisted in `auto_sell_rules`; mobile + web
 * bind to the same DTO. Trigger config is flattened to `triggerType` +
 * `triggerConfig` (the alert_rules convention) so both rule systems read alike.
 *
 * Firing is NOT done here — the auto-sell executor (client today, delegated-signer
 * engine later) reads these rules; the per-account kill switch gates all firing.
 */

export const AUTO_SELL_TRIGGER_TYPES = [
  'mc_milestone',
  'pct_gain',
  'time_elapsed',
  'stop_loss_mc',
  'trailing_stop',
] as const;
export type AutoSellTriggerType = (typeof AUTO_SELL_TRIGGER_TYPES)[number];

export const McMilestoneConfigSchema = z.object({ targetMcUsd: z.number().positive().max(1_000_000_000) }).strict();
export const PctGainConfigSchema = z.object({ gainPct: z.number().positive().max(1_000_000) }).strict();
export const TimeElapsedConfigSchema = z.object({ minutes: z.number().int().min(1).max(60 * 24 * 30) }).strict();
export const StopLossMcConfigSchema = z.object({ mcUsd: z.number().positive().max(1_000_000_000) }).strict();
export const TrailingStopConfigSchema = z.object({ trailPct: z.number().min(0.5).max(90) }).strict();

export type AutoSellTriggerConfig =
  | z.infer<typeof McMilestoneConfigSchema>
  | z.infer<typeof PctGainConfigSchema>
  | z.infer<typeof TimeElapsedConfigSchema>
  | z.infer<typeof StopLossMcConfigSchema>
  | z.infer<typeof TrailingStopConfigSchema>;

export const AutoSellTokenScopeSchema = z
  .object({
    kind: z.enum(['mint', 'all_held']),
    mint: z.string().trim().min(20).max(64).optional(),
  })
  .strict()
  .refine((v) => v.kind !== 'mint' || Boolean(v.mint), { message: 'mint scope requires a mint' });
export type AutoSellTokenScope = z.infer<typeof AutoSellTokenScopeSchema>;

export const AutoSellRuleBodySchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    triggerType: z.enum(AUTO_SELL_TRIGGER_TYPES),
    triggerConfig: z.unknown(),
    sellPct: z.number().min(1).max(100),
    tokenScope: AutoSellTokenScopeSchema.optional(),
    walletScope: z.literal('primary').optional(),
    cooldownSeconds: z.number().int().min(0).max(86_400).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type AutoSellRuleBody = z.infer<typeof AutoSellRuleBodySchema>;

/** Same body, all-optional, for PATCH. */
export const AutoSellRulePatchSchema = AutoSellRuleBodySchema.partial();
export type AutoSellRulePatch = z.infer<typeof AutoSellRulePatchSchema>;

export function parseAutoSellTriggerConfig(
  type: AutoSellTriggerType,
  raw: unknown,
): AutoSellTriggerConfig | null {
  const s =
    type === 'mc_milestone'
      ? McMilestoneConfigSchema
      : type === 'pct_gain'
        ? PctGainConfigSchema
        : type === 'time_elapsed'
          ? TimeElapsedConfigSchema
          : type === 'stop_loss_mc'
            ? StopLossMcConfigSchema
            : TrailingStopConfigSchema;
  const r = s.safeParse(raw);
  return r.success ? (r.data as AutoSellTriggerConfig) : null;
}

/** Canonical DTO returned by /api/auto-sell (camelCase). */
export type AutoSellRuleDto = {
  id: string;
  name: string;
  triggerType: AutoSellTriggerType;
  triggerConfig: AutoSellTriggerConfig;
  sellPct: number;
  tokenScope: AutoSellTokenScope;
  walletScope: 'primary';
  cooldownSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AutoSellRuleRow = {
  id: string;
  name: string | null;
  trigger_type: string;
  trigger_config: unknown;
  sell_pct: number | string;
  token_scope: unknown;
  wallet_scope: string | null;
  cooldown_seconds: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function autoSellRuleToDto(row: AutoSellRuleRow): AutoSellRuleDto {
  const triggerType = (AUTO_SELL_TRIGGER_TYPES as readonly string[]).includes(row.trigger_type)
    ? (row.trigger_type as AutoSellTriggerType)
    : 'pct_gain';
  const triggerConfig =
    parseAutoSellTriggerConfig(triggerType, row.trigger_config) ?? ({ gainPct: 0 } as AutoSellTriggerConfig);
  const scope = AutoSellTokenScopeSchema.safeParse(row.token_scope);
  return {
    id: row.id,
    name: row.name ?? '',
    triggerType,
    triggerConfig,
    sellPct: Number(row.sell_pct),
    tokenScope: scope.success ? scope.data : { kind: 'all_held' },
    walletScope: 'primary',
    cooldownSeconds: Number(row.cooldown_seconds ?? 0),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
