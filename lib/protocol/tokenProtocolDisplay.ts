import type { AppChainId } from '@/lib/chains/appChain';
import { protocolBrand, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';
import { protocolIdToFilterId } from '@/lib/protocol/registry';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '@/lib/protocol/types';

export function protocolBrandIdFromToken(token: {
  protocol_id?: string | null;
  source_confidence?: number | null;
}): ProtocolBrandId | null {
  const conf = token.source_confidence ?? 0;
  if (!token.protocol_id || conf < PROTOCOL_FILTER_MIN_CONFIDENCE) return null;
  const filterId = protocolIdToFilterId(token.protocol_id);
  if (!filterId) return null;
  return protocolBrand(filterId)?.id ?? (filterId as ProtocolBrandId);
}

export function filterIdsFromTokenBundle(token: {
  protocol_id?: string | null;
  source_confidence?: number | null;
}): string[] {
  const conf = token.source_confidence ?? 0;
  if (!token.protocol_id || conf < PROTOCOL_FILTER_MIN_CONFIDENCE) return [];
  const filterId = protocolIdToFilterId(token.protocol_id);
  return filterId ? [filterId] : [];
}

export function chainFromTokenRow(token: { chain_id?: string | null }, fallback: AppChainId): AppChainId {
  const c = token.chain_id;
  if (c === 'sol' || c === 'ton' || c === 'eth' || c === 'bnb' || c === 'base') return c;
  return fallback;
}
