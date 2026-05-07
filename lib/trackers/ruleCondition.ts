import { z } from 'zod';

export const TrackerRuleEventTypeSchema = z.enum([
  'token_launch',
  'swap_buy',
  'swap_sell',
  'any_trade',
]);

export type TrackerRuleEventType = z.infer<typeof TrackerRuleEventTypeSchema>;

/** Structured condition persisted on `tracker_rules.condition` and produced by the NL parser. */
export const TrackerRuleConditionSchema = z
  .object({
    eventTypes: z.array(TrackerRuleEventTypeSchema).min(1).max(8),
    launchpadsAnyOf: z.array(z.string().max(48)).max(8).nullable().optional(),
    minSol: z.number().min(0).max(1e9).nullable().optional(),
    mintFilter: z.string().max(64).nullable().optional(),
  })
  .strict();

export type TrackerRuleCondition = z.infer<typeof TrackerRuleConditionSchema>;

export function parseRuleCondition(json: unknown): TrackerRuleCondition | null {
  const r = TrackerRuleConditionSchema.safeParse(json);
  return r.success ? r.data : null;
}
