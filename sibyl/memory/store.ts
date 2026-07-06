import 'server-only';

import type { EntityUpsert, SibylEntity } from '@/sibyl/memory/types';

/**
 * MVP memory store: in-process map (survives within a warm instance). The interface
 * is DB-shaped so swapping to a `sibyl_entities` Supabase table (or a vector store
 * for semantic recall) is a drop-in — see CHECKLIST. Pass a real timestamp in;
 * we don't call Date in the store so it stays deterministic/testable.
 */
const mem = new Map<string, SibylEntity>();

export function upsertEntity(e: EntityUpsert, nowIso: string): SibylEntity {
  const prev = mem.get(e.id);
  const merged: SibylEntity = {
    id: e.id,
    kind: e.kind,
    name: e.name,
    aliases: uniq([...(prev?.aliases ?? []), ...(e.aliases ?? [])]),
    linkedWallets: uniq([...(prev?.linkedWallets ?? []), ...(e.linkedWallets ?? [])]),
    linkedSocials: uniq([...(prev?.linkedSocials ?? []), ...(e.linkedSocials ?? [])]),
    description: e.description ?? prev?.description ?? '',
    confidence: e.confidence ?? prev?.confidence ?? 0.5,
    source: e.source ?? prev?.source ?? 'sibyl',
    firstSeen: prev?.firstSeen ?? nowIso,
    lastSeen: nowIso,
    relatedEntities: uniq([...(prev?.relatedEntities ?? []), ...(e.relatedEntities ?? [])]),
  };
  mem.set(e.id, merged);
  return merged;
}

export function getEntity(id: string): SibylEntity | null {
  return mem.get(id) ?? null;
}

export function searchEntities(term: string, limit = 10): SibylEntity[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return [...mem.values()]
    .filter((e) => e.name.toLowerCase().includes(t) || e.aliases.some((a) => a.toLowerCase().includes(t)))
    .slice(0, limit);
}

function uniq<T>(a: T[]): T[] {
  return [...new Set(a)];
}
