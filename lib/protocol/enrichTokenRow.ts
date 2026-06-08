import 'server-only';

import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { buildClassifierInputFromLaunchEvent, ingestHintFromSource } from '@/lib/protocol/buildClassifierInput';
import { classificationFieldsForInsert, classificationPatchForIngest } from '@/lib/protocol/applyClassification';
import type { ClassifierInput, ClassificationSource } from '@/lib/protocol/types';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { TokenRow } from '@/lib/db/tokens';

export function enrichTokenInsertFromLaunchEvent(
  base: TablesInsert<'tokens'>,
  ev: LaunchpadEvent,
  alertSource: string,
): TablesInsert<'tokens'> {
  const input = buildClassifierInputFromLaunchEvent(ev, null, {
    ingest_hint: ingestHintFromSource(alertSource),
    solana_program_id: ev.solana_program_id ?? null,
    launch_pad: base.launch_pad ?? null,
  });
  return { ...base, ...classificationFieldsForInsert(input) };
}

export function classificationUpdateFromLaunchEvent(
  ev: LaunchpadEvent,
  existing: TokenRow,
  alertSource: string,
  overrides?: Partial<ClassifierInput>,
): TablesUpdate<'tokens'> | null {
  const input = buildClassifierInputFromLaunchEvent(ev, existing, {
    ingest_hint: ingestHintFromSource(alertSource),
    solana_program_id: ev.solana_program_id ?? null,
    ...overrides,
  });
  return classificationPatchForIngest(input, existing);
}

export function classificationUpdateFromTokenFields(
  row: Pick<
    TokenRow,
    | 'mint'
    | 'launch_pad'
    | 'raw_metadata'
    | 'bonding_progress'
    | 'migrated_at'
    | 'migrated_to'
    | 'protocol_id'
    | 'source_confidence'
  >,
  ingestHint: ClassificationSource,
): TablesUpdate<'tokens'> | null {
  const launchpad: LaunchpadEvent['launchpad'] =
    row.launch_pad === 'ton' || row.launch_pad == null ? 'unknown' : (row.launch_pad as LaunchpadEvent['launchpad']);
  const input = buildClassifierInputFromLaunchEvent(
    {
      launchpad,
      mint: row.mint,
      creator_wallet: null,
      symbol: null,
      name: null,
      image_url: null,
      initial_liquidity_sol: null,
      bonding_progress: row.bonding_progress,
      raw: row.raw_metadata ?? {},
    },
    row,
    { ingest_hint: ingestHint },
  );
  return classificationPatchForIngest(input, row);
}
