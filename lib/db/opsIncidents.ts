import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import {
  applyAction,
  type IncidentAction,
  type IncidentStatus,
  type IncidentTimelineEntry,
} from '@/lib/ops/incidentLifecycle';
import type { Json, Tables } from '@/lib/supabase/types';

/**
 * Incident lifecycle I/O. Drives the existing `ops_incidents` rows through the
 * state machine — NO migration needed: `status` + `resolved_at` are real columns,
 * and owner / notes / timeline / runbook / postmortem ride in the existing
 * `detail` jsonb under `detail.lifecycle`.
 */

export type OpsIncidentRow = Tables<'ops_incidents'>;

export type IncidentLifecycle = {
  owner?: string | null;
  runbookUrl?: string | null;
  postmortem?: string | null;
  resolution?: string | null;
  timeline?: IncidentTimelineEntry[];
};

export function readLifecycle(detail: Json): IncidentLifecycle {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const lc = (detail as Record<string, unknown>).lifecycle;
    if (lc && typeof lc === 'object' && !Array.isArray(lc)) return lc as IncidentLifecycle;
  }
  return {};
}

function mergeDetail(detail: Json, lifecycle: IncidentLifecycle): Json {
  const base = detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : {};
  return { ...base, lifecycle } as unknown as Json;
}

export async function listIncidents(opts?: { activeOnly?: boolean; limit?: number }): Promise<OpsIncidentRow[]> {
  const supabase = createAdminSupabase();
  const base = supabase
    .from('ops_incidents')
    .select('*')
    .order('last_seen', { ascending: false })
    .limit(opts?.limit ?? 50);
  const { data, error } = opts?.activeOnly ? await base.neq('status', 'resolved') : await base;
  if (error) throw new Error(`listIncidents: ${error.message}`);
  return data ?? [];
}

async function getIncident(id: string): Promise<OpsIncidentRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('ops_incidents').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getIncident: ${error.message}`);
  if (!data) throw new Error('incident_not_found');
  return data;
}

/** Drive an incident through a lifecycle action (validated by the pure machine). */
export async function transitionIncident(input: {
  id: string;
  action: IncidentAction;
  actor: string;
  note?: string;
}): Promise<{ from: IncidentStatus; to: IncidentStatus }> {
  const inc = await getIncident(input.id);
  const from = inc.status as IncidentStatus;
  const to = applyAction(from, input.action);
  if (!to) throw new Error(`invalid_transition: ${input.action} from ${from}`);

  const lc = readLifecycle(inc.detail);
  const entry: IncidentTimelineEntry = {
    at: new Date().toISOString(),
    actor: input.actor,
    kind: 'status',
    from,
    to,
    ...(input.note ? { note: input.note } : {}),
  };
  const detail = mergeDetail(inc.detail, { ...lc, timeline: [...(lc.timeline ?? []), entry] });

  const patch: Partial<OpsIncidentRow> = { status: to, detail };
  if (to === 'resolved') patch.resolved_at = new Date().toISOString();
  if (to === 'open') patch.resolved_at = null;

  const supabase = createAdminSupabase();
  const { error } = await supabase.from('ops_incidents').update(patch).eq('id', input.id);
  if (error) throw new Error(`transitionIncident: ${error.message}`);
  return { from, to };
}

/** Set owner / runbook / postmortem / resolution and/or append a note. */
export async function updateIncidentMeta(input: {
  id: string;
  actor: string;
  owner?: string | null;
  runbookUrl?: string | null;
  postmortem?: string | null;
  resolution?: string | null;
  note?: string;
}): Promise<void> {
  const inc = await getIncident(input.id);
  const lc = readLifecycle(inc.detail);
  const next: IncidentLifecycle = { ...lc };
  const timeline = [...(lc.timeline ?? [])];

  if (input.owner !== undefined && input.owner !== lc.owner) {
    next.owner = input.owner;
    timeline.push({ at: new Date().toISOString(), actor: input.actor, kind: 'assign', note: input.owner ? `owner → ${input.owner}` : 'unassigned' });
  }
  if (input.runbookUrl !== undefined) next.runbookUrl = input.runbookUrl;
  if (input.postmortem !== undefined) next.postmortem = input.postmortem;
  if (input.resolution !== undefined) next.resolution = input.resolution;
  if (input.note) timeline.push({ at: new Date().toISOString(), actor: input.actor, kind: 'note', note: input.note });

  next.timeline = timeline;
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('ops_incidents')
    .update({ detail: mergeDetail(inc.detail, next) })
    .eq('id', input.id);
  if (error) throw new Error(`updateIncidentMeta: ${error.message}`);
}
