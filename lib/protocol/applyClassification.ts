import 'server-only';

import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import {
  classificationToDbPatch,
  classifyTokenProtocol,
  shouldApplyClassification,
  type ClassifierInput,
} from '@/lib/protocol/classifyTokenProtocol';
import type { TokenClassification } from '@/lib/protocol/types';

export function buildClassifierInputFromToken(row: {
  mint: string;
  launch_pad?: string | null;
  raw_metadata?: unknown;
  bonding_progress?: number | null;
  migrated_at?: string | null;
  migrated_to?: string | null;
  protocol_id?: string | null;
  source_confidence?: number | null;
}): ClassifierInput {
  return {
    mint: row.mint,
    launch_pad: row.launch_pad,
    raw_metadata: row.raw_metadata,
    bonding_progress: row.bonding_progress,
    migrated_at: row.migrated_at,
    migrated_to: row.migrated_to,
    existing: row.protocol_id
      ? { protocol_id: row.protocol_id as TokenClassification['protocol_id'], source_confidence: row.source_confidence ?? undefined }
      : null,
  };
}

export function classificationPatchForIngest(
  input: ClassifierInput,
  existing?: Partial<{ protocol_id?: string | null; source_confidence?: number | null }> | null,
): TablesUpdate<'tokens'> | null {
  const incoming = classifyTokenProtocol(input);
  if (!shouldApplyClassification(existing, incoming)) return null;
  return classificationToDbPatch(incoming);
}

export function classificationFieldsForInsert(
  input: ClassifierInput,
): Partial<TablesInsert<'tokens'>> {
  const c = classifyTokenProtocol(input);
  return classificationToDbPatch(c);
}

export { classifyTokenProtocol, classificationToDbPatch, shouldApplyClassification };
export type { ClassifierInput };
