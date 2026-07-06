/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Sibyl memory — persistence layer (the flywheel). Writes are FAIL-OPEN: if Supabase
 * isn't configured or a query errors, every function no-ops so a scan is never broken
 * by the memory layer. The sibyl_* tables aren't in the generated Database types, so
 * this module uses a loosely-typed admin client on purpose. Read-only vs trading paths.
 */
function sb(): any | null {
  try {
    return createAdminSupabase() as any;
  } catch {
    return null;
  }
}

export type ScanRow = {
  query: string;
  subject_kind: string | null;
  subject_ref: string | null;
  chain: string | null;
  mode: string | null;
  verdict: string | null;
  confidence: number | null;
  action: string | null;
  why: unknown;
  agents_run: unknown;
  sources: unknown;
  caveats: unknown;
  entities: unknown;
  cards: unknown;
  model?: string | null;
  latency_ms?: number | null;
  user_id?: string | null;
};

export async function insertScan(row: ScanRow): Promise<string | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data, error } = await c.from('sibyl_scans').insert(row).select('id').single();
    if (error) return null;
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

export async function recordEntities(entities: unknown[], nowIso: string): Promise<void> {
  const c = sb();
  if (!c || !entities.length) return;
  try {
    await c.rpc('sibyl_record_entities', { _entities: entities, _now: nowIso });
  } catch {
    /* fail-open */
  }
}

export type EntityRow = { seen_count: number; first_seen: string; last_seen: string; name: string };
export async function getEntityRow(id: string): Promise<EntityRow | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data } = await c.from('sibyl_entities').select('seen_count, first_seen, last_seen, name').eq('id', id).maybeSingle();
    return (data as EntityRow) ?? null;
  } catch {
    return null;
  }
}

export type PendingOutcome = { id: string; subject_ref: string; chain: string | null; prediction: any; predicted_at: string };

export async function pendingOutcomesForMint(mint: string): Promise<PendingOutcome[]> {
  const c = sb();
  if (!c) return [];
  try {
    const { data } = await c.from('sibyl_outcomes').select('id, subject_ref, chain, prediction, predicted_at').eq('subject_ref', mint).eq('status', 'pending').limit(20);
    return (data as PendingOutcome[]) ?? [];
  } catch {
    return [];
  }
}

export async function pendingOutcomesOlderThan(hours: number, limit = 50): Promise<PendingOutcome[]> {
  const c = sb();
  if (!c) return [];
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    const { data } = await c.from('sibyl_outcomes').select('id, subject_ref, chain, prediction, predicted_at').eq('status', 'pending').lt('predicted_at', cutoff).limit(limit);
    return (data as PendingOutcome[]) ?? [];
  } catch {
    return [];
  }
}

export async function resolveOutcome(id: string, outcome: unknown, nowIso: string): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    await c.from('sibyl_outcomes').update({ status: 'resolved', resolved_at: nowIso, outcome }).eq('id', id);
  } catch {
    /* fail-open */
  }
}

export async function insertPendingOutcome(row: { scan_id: string | null; subject_kind: string | null; subject_ref: string; chain: string | null; prediction: unknown }): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    await c.from('sibyl_outcomes').insert(row);
  } catch {
    /* fail-open */
  }
}

export type MemoryCounts = { scans: number; entities: number; pending: number; resolved: number };
export async function memoryCounts(): Promise<MemoryCounts | null> {
  const c = sb();
  if (!c) return null;
  try {
    const head = { count: 'exact' as const, head: true };
    const [s, e, p, r] = await Promise.all([
      c.from('sibyl_scans').select('*', head),
      c.from('sibyl_entities').select('*', head),
      c.from('sibyl_outcomes').select('*', head).eq('status', 'pending'),
      c.from('sibyl_outcomes').select('*', head).eq('status', 'resolved'),
    ]);
    return { scans: s.count ?? 0, entities: e.count ?? 0, pending: p.count ?? 0, resolved: r.count ?? 0 };
  } catch {
    return null;
  }
}
