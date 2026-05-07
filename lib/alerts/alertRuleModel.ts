import { z } from 'zod';
import {
  PULSE_PROTOCOL_IDS,
  type PulseProtocolId,
} from '@/lib/tokens/columnPresetModel';

export const ALERT_RULE_TYPES = ['pulse_launchpad'] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

export const ALERT_TYPE_ALERT_RULE = 'alert_rule' as const;

const PROTOCOL_IDS_ENUM = PULSE_PROTOCOL_IDS as unknown as [
  PulseProtocolId,
  ...PulseProtocolId[],
];

export const PulseLaunchpadRuleConfigSchema = z
  .object({
    launchpads: z.array(z.enum(PROTOCOL_IDS_ENUM)).optional(),
    minInitialLiquiditySol: z.number().nonnegative().nullable().optional(),
  })
  .strict();

export type PulseLaunchpadRuleConfig = z.infer<typeof PulseLaunchpadRuleConfigSchema>;

export function parsePulseLaunchpadRuleConfig(raw: unknown): PulseLaunchpadRuleConfig | null {
  const p = PulseLaunchpadRuleConfigSchema.safeParse(raw ?? {});
  return p.success ? p.data : null;
}

export function launchpadFilterMatchesProtocols(
  launchPad: string | null,
  filter: PulseProtocolId[] | undefined,
  padToProtocols: (pad: string | null) => PulseProtocolId[],
): boolean {
  if (!filter || filter.length === 0) return true;
  const detected = new Set(padToProtocols(launchPad));
  return filter.some((f) => detected.has(f));
}
