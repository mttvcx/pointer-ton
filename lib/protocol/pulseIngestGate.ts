import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { buildClassifierInputFromLaunchEvent, ingestHintFromSource } from '@/lib/protocol/buildClassifierInput';
import { classifyTokenProtocol } from '@/lib/protocol/classifyCore';
import { PROTOCOL_FILTER_MIN_CONFIDENCE, type TokenClassification } from '@/lib/protocol/types';
import type { TokenRow } from '@/lib/db/tokens';

export function classifyLaunchEventForIngest(
  ev: LaunchpadEvent,
  alertSource: string,
  opts?: {
    dasAuthorityPad?: string | null;
    existing?: Pick<
      TokenRow,
      'migrated_at' | 'migrated_to' | 'protocol_id' | 'source_confidence'
    > | null;
  },
): TokenClassification {
  const input = buildClassifierInputFromLaunchEvent(ev, opts?.existing ?? null, {
    ingest_hint: ingestHintFromSource(alertSource),
    das_authority_pad: opts?.dasAuthorityPad ?? null,
    solana_program_id: ev.solana_program_id ?? null,
    launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
  });
  return classifyTokenProtocol(input);
}

/** Minimum bar for mints discovered via wallet search / hydration — not launchpad authority feeds. */
export function meetsPulseDiscoveryThreshold(c: TokenClassification): boolean {
  return !!c.protocol_id && c.source_confidence >= PROTOCOL_FILTER_MIN_CONFIDENCE;
}

export function isNonAuthorityDiscoverySource(alertSource: string): boolean {
  return alertSource === 'das_search' || alertSource === 'das_hydrate';
}
