import 'server-only';

import { z } from 'zod';

import { TrackerRuleConditionSchema } from '@/lib/trackers/ruleCondition';

/**
 * Zod schemas for every cascade pipeline. The cascade validates the model
 * output against `outputSchema` and refuses to return invalid JSON to callers.
 *
 * Keep response surfaces small - the cascade runs on the cheapest model first
 * and we want it to consistently produce valid structured output.
 */

export const ExplainTokenOutputSchema = z
  .object({
    summary: z.string().min(1).max(700),
    bullCase: z.array(z.string().min(1).max(220)).min(1).max(4),
    bearCase: z.array(z.string().min(1).max(220)).min(1).max(4),
    riskFlags: z.array(z.string().min(1).max(120)).max(6).default([]),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .strict();
export type ExplainTokenOutput = z.infer<typeof ExplainTokenOutputSchema>;

export const ExplainWalletOutputSchema = z
  .object({
    archetype: z.enum(['kol', 'sniper', 'trader', 'whale', 'dev', 'unknown']),
    summary: z.string().min(1).max(600),
    strengths: z.array(z.string().min(1).max(180)).max(4).default([]),
    cautions: z.array(z.string().min(1).max(180)).max(4).default([]),
    confidence: z.enum(['low', 'medium', 'high']),
  })
  .strict();
export type ExplainWalletOutput = z.infer<typeof ExplainWalletOutputSchema>;

export const TooltipOutputSchema = z
  .object({
    text: z.string().min(1).max(220),
  })
  .strict();
export type TooltipOutput = z.infer<typeof TooltipOutputSchema>;

export const NarrateAlertOutputSchema = z
  .object({
    headline: z.string().min(1).max(120),
    body: z.string().min(1).max(360),
    severity: z.enum(['info', 'warn', 'critical']).default('info'),
  })
  .strict();
export type NarrateAlertOutput = z.infer<typeof NarrateAlertOutputSchema>;

export const ParseTrackerRuleOutputSchema = z
  .object({
    summary: z.string().min(1).max(240),
    condition: TrackerRuleConditionSchema,
  })
  .strict();
export type ParseTrackerRuleOutput = z.infer<typeof ParseTrackerRuleOutputSchema>;

export const PIPELINE_SCHEMAS = {
  explainToken: ExplainTokenOutputSchema,
  explainWallet: ExplainWalletOutputSchema,
  tooltip: TooltipOutputSchema,
  narrateAlert: NarrateAlertOutputSchema,
  parseTrackerRule: ParseTrackerRuleOutputSchema,
} as const;

export type PipelineId = keyof typeof PIPELINE_SCHEMAS;

export const PIPELINE_IDS: PipelineId[] = Object.keys(
  PIPELINE_SCHEMAS,
) as PipelineId[];
