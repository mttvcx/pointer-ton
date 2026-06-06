import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { buildSoloLeaderboard } from '@/lib/championship/scoring';
import type { ChampionshipParticipantStats, ReviewStatus } from '@/lib/championship/types';
import type { Json, Tables } from '@/lib/supabase/types';

export type ChampionshipEventRow = Tables<'championship_events'>;
export type ChampionshipParticipantRow = Tables<'championship_participants'>;
export type ChampionshipFinalizationRow = Tables<'championship_finalizations'>;

export const REVIEW_STATUSES: ReviewStatus[] = [
  'eligible',
  'low_sample',
  'under_review',
  'flagged',
  'disqualified',
  'finalized',
];

function toStats(row: ChampionshipParticipantRow): ChampionshipParticipantStats {
  return {
    userId: row.user_id ?? row.id,
    displayName: row.display_name,
    handle: row.handle ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    avatarUrl: row.avatar_url,
    realizedPnlUsd: Number(row.realized_pnl_usd),
    eventVolumeUsd: Number(row.event_volume_usd),
    closedTrades: row.closed_trades,
    profitableClosedTrades: row.profitable_closed_trades,
    uniqueTokensTraded: row.unique_tokens_traded,
    biggestWinRoiPct: Number(row.biggest_win_roi_pct),
    roiPct: Number(row.roi_pct),
    maxDrawdownPct: Number(row.max_drawdown_pct),
    suspiciousFlags: Array.isArray(row.suspicious_flags) ? (row.suspicious_flags as string[]) : [],
    reviewStatus: row.review_status as ReviewStatus,
    closedTradeRoisPct: Array.isArray(row.closed_trade_rois_pct)
      ? (row.closed_trade_rois_pct as number[])
      : [],
  };
}

export async function listChampionshipEvents(limit = 100): Promise<ChampionshipEventRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('championship_events')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listChampionshipEvents failed: ${error.message}`);
  return data ?? [];
}

export async function getChampionshipEvent(id: string): Promise<ChampionshipEventRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('championship_events').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getChampionshipEvent failed: ${error.message}`);
  return data ?? null;
}

export async function listParticipants(eventId: string): Promise<ChampionshipParticipantRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('championship_participants')
    .select('*')
    .eq('event_id', eventId)
    .order('realized_pnl_usd', { ascending: false });
  if (error) throw new Error(`listParticipants failed: ${error.message}`);
  return data ?? [];
}

export async function setParticipantReviewStatus(input: {
  participantId: string;
  reviewStatus: ReviewStatus;
}): Promise<ChampionshipParticipantRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('championship_participants')
    .update({ review_status: input.reviewStatus, updated_at: new Date().toISOString() })
    .eq('id', input.participantId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`setParticipantReviewStatus failed: ${error?.message}`);
  return data;
}

/**
 * Finalize an event: freeze a leaderboard snapshot computed from the current
 * participant rows (via the shared scoring lib), mark the event finalized, and
 * record who did it. Refuses to re-finalize an already finalized event.
 */
export async function finalizeChampionshipEvent(input: {
  eventId: string;
  finalizedByUserId: string | null;
  reason: string;
}): Promise<{ event: ChampionshipEventRow; entries: number }> {
  const supabase = createAdminSupabase();

  const event = await getChampionshipEvent(input.eventId);
  if (!event) throw new Error('event_not_found');
  if (event.status === 'finalized' || event.finalized_at) throw new Error('already_finalized');

  const participants = await listParticipants(input.eventId);
  const leaderboard = buildSoloLeaderboard(participants.map(toStats));

  const nowIso = new Date().toISOString();

  const { error: finErr } = await supabase.from('championship_finalizations').insert({
    event_id: input.eventId,
    leaderboard: leaderboard as unknown as Json,
    finalized_by: input.finalizedByUserId,
    reason: input.reason,
  });
  if (finErr) throw new Error(`finalize insert failed: ${finErr.message}`);

  const { data: updated, error: updErr } = await supabase
    .from('championship_events')
    .update({ status: 'finalized', finalized_at: nowIso })
    .eq('id', input.eventId)
    .select('*')
    .single();
  if (updErr || !updated) throw new Error(`finalize event update failed: ${updErr?.message}`);

  return { event: updated, entries: leaderboard.length };
}

export async function getFinalization(eventId: string): Promise<ChampionshipFinalizationRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('championship_finalizations')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw new Error(`getFinalization failed: ${error.message}`);
  return data ?? null;
}
