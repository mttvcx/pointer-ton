import type { LaunchpadEvent } from '@/lib/helius/parsers';
import type { ClassifierInput, ClassificationSource } from '@/lib/protocol/types';
import { LAUNCHPAD_PROGRAM_IDS } from '@/lib/utils/constants';

const PAD_TO_PROGRAM: Record<string, string> = {
  'pump.fun': LAUNCHPAD_PROGRAM_IDS.pumpFun,
  bonk: LAUNCHPAD_PROGRAM_IDS.bonk,
  bags: LAUNCHPAD_PROGRAM_IDS.bags,
  printr: LAUNCHPAD_PROGRAM_IDS.printr,
  moonshot: LAUNCHPAD_PROGRAM_IDS.moonshot,
  heaven: LAUNCHPAD_PROGRAM_IDS.heaven,
  'dynamic-bc': LAUNCHPAD_PROGRAM_IDS.believeDbc,
};

export function buildClassifierInputFromLaunchEvent(
  ev: LaunchpadEvent,
  existing?: {
    migrated_at?: string | null;
    migrated_to?: string | null;
    protocol_id?: string | null;
    source_confidence?: number | null;
  } | null,
  overrides?: Partial<ClassifierInput>,
): ClassifierInput {
  const raw = ev.raw && typeof ev.raw === 'object' && !Array.isArray(ev.raw) ? (ev.raw as Record<string, unknown>) : {};
  const geckoNetwork = raw.geckoNetwork;
  const launchPad = overrides?.launch_pad ?? (ev.launchpad === 'unknown' ? null : ev.launchpad);

  let solana_program_id = overrides?.solana_program_id ?? ev.solana_program_id ?? null;
  if (!solana_program_id && launchPad && PAD_TO_PROGRAM[launchPad]) {
    solana_program_id = PAD_TO_PROGRAM[launchPad] ?? null;
  }

  return {
    mint: ev.mint,
    launch_pad: launchPad,
    raw_metadata: ev.raw,
    bonding_progress: ev.bonding_progress,
    migrated_at: existing?.migrated_at ?? null,
    migrated_to: existing?.migrated_to ?? null,
    gecko_network:
      geckoNetwork === 'eth' || geckoNetwork === 'bsc' || geckoNetwork === 'base' ? geckoNetwork : null,
    gecko_pool: raw.geckoPool,
    dexscreener_dex_id: typeof raw.dexId === 'string' ? raw.dexId : null,
    das_authority_pad: overrides?.das_authority_pad ?? null,
    solana_program_id,
    ingest_hint: overrides?.ingest_hint,
    existing: existing?.protocol_id
      ? {
          protocol_id: existing.protocol_id as ClassifierInput['existing'] extends infer E
            ? E extends { protocol_id?: infer P }
              ? P
              : never
            : never,
          source_confidence: existing.source_confidence ?? undefined,
        }
      : null,
    ...overrides,
  };
}

export function ingestHintFromSource(source: string): ClassificationSource {
  if (source === 'das_authority') return 'helius_das_authority';
  if (source === 'das_search') return 'helius_das_search';
  if (source === 'das_hydrate') return 'helius_das_hydrate';
  if (source.includes('webhook')) return 'helius_webhook_program';
  if (source.includes('gecko')) return 'gecko_dex';
  if (source.includes('dexscreener')) return 'dexscreener_dex';
  if (source.includes('ton')) return 'tonapi_jetton';
  if (source === 'backfill') return 'backfill';
  if (source === 'migration_program') return 'migration_program';
  return 'launch_pad_legacy';
}

/** Read pointerIngestSource stamped on raw_metadata during ingest. */
export function ingestHintFromRawMetadata(raw: unknown): ClassificationSource | null {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const src = typeof r?.pointerIngestSource === 'string' ? r.pointerIngestSource : null;
  return src ? ingestHintFromSource(src) : null;
}
