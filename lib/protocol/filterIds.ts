import { protocolIdToFilterId } from '@/lib/protocol/registry';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '@/lib/protocol/types';

export function filterIdsFromTokenRow(token: {
  protocol_id?: string | null;
  source_confidence?: number | null;
}): string[] {
  const conf = token.source_confidence ?? 0;
  if (!token.protocol_id || conf < PROTOCOL_FILTER_MIN_CONFIDENCE) return [];
  const filterId = protocolIdToFilterId(token.protocol_id);
  return filterId ? [filterId] : [];
}
