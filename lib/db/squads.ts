import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- squads/squad_members not in generated types until the Phase 2 migration is applied */

import { randomUUID } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/server';
import type {
  ChainFocus,
  SquadCreateInput,
  SquadMemberRole,
  SquadMemberStatus,
  SquadSummary,
  SquadVisibility,
  TradingStyle,
} from '@/lib/squads/types';

export function isMissingSquadsTable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /missing_squads_table|does not exist|schema cache|42P01|squads/i.test(err.message);
}

function throwIfMissing(error: { message: string }): never {
  if (/does not exist|schema cache|42P01|squads/i.test(String(error.message))) {
    throw new Error('missing_squads_table');
  }
  throw new Error(error.message);
}

function mapRow(row: Record<string, unknown>, isMember: boolean): SquadSummary {
  return {
    id: String(row.id),
    slug: String((row.slug ?? row.id) as string),
    name: String(row.name),
    description: String(row.description ?? ''),
    chainFocus: (row.chain_focus as ChainFocus[]) ?? ['sol'],
    tradingStyles: (row.trading_styles as TradingStyle[]) ?? ['trenches'],
    visibility: (row.visibility as SquadVisibility) ?? 'private',
    memberCount: Math.max(0, Number(row.member_count ?? 0)),
    isMember,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${base || 'squad'}-${randomUUID().slice(0, 6)}`;
}

export type SquadMemberView = {
  userId: string;
  role: SquadMemberRole;
  status: SquadMemberStatus;
  joinedAt: string;
  username: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
};

/** Squads the user is an active member of. */
export async function listSquadsForUser(userId: string): Promise<SquadSummary[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('squad_members')
    .select('squads(*)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throwIfMissing(error);
  const rows = (data ?? []) as Array<{ squads: Record<string, unknown> | null }>;
  return rows.map((r) => (r.squads ? mapRow(r.squads, true) : null)).filter((x): x is SquadSummary => Boolean(x));
}

/** Public / request-to-join squads for the discover tab, with isMember computed. */
export async function listDiscoverSquads(userId: string, limit = 50): Promise<SquadSummary[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('squads')
    .select('*')
    .in('visibility', ['public', 'request_to_join'])
    .order('member_count', { ascending: false })
    .limit(limit);
  if (error) throwIfMissing(error);

  const squads = (data ?? []) as Array<Record<string, unknown>>;
  if (squads.length === 0) return [];

  const ids = squads.map((s) => String(s.id));
  const { data: mine } = await db
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('squad_id', ids);
  const memberSet = new Set(((mine ?? []) as Array<{ squad_id: string }>).map((m) => m.squad_id));
  return squads.map((s) => mapRow(s, memberSet.has(String(s.id))));
}

/** Squad detail + members. Returns null if not found. */
export async function getSquadDetail(
  squadId: string,
  userId: string,
): Promise<{ squad: SquadSummary; members: SquadMemberView[] } | null> {
  const db = createAdminSupabase() as any;
  const { data: squad, error } = await db.from('squads').select('*').eq('id', squadId).maybeSingle();
  if (error) throwIfMissing(error);
  if (!squad) return null;

  const { data: memberRows } = await db
    .from('squad_members')
    .select('user_id, role, status, joined_at, users(username, wallet_address, twitter_handle)')
    .eq('squad_id', squadId)
    .neq('status', 'left')
    .order('joined_at', { ascending: true });

  const members: SquadMemberView[] = ((memberRows ?? []) as any[]).map((m) => ({
    userId: String(m.user_id),
    role: (m.role ?? 'member') as SquadMemberRole,
    status: (m.status ?? 'active') as SquadMemberStatus,
    joinedAt: String(m.joined_at ?? new Date().toISOString()),
    username: m.users?.username ?? null,
    walletAddress: m.users?.wallet_address ?? null,
    twitterHandle: m.users?.twitter_handle ?? null,
  }));

  const isMember = members.some((m) => m.userId === userId && m.status === 'active');
  return { squad: mapRow(squad, isMember), members };
}

/** Create a squad and make the creator its active owner. */
export async function createSquad(userId: string, input: SquadCreateInput): Promise<SquadSummary> {
  const db = createAdminSupabase() as any;
  const { data: squad, error } = await db
    .from('squads')
    .insert({
      slug: slugify(input.name),
      name: input.name,
      description: input.description ?? '',
      chain_focus: input.chainFocus,
      trading_styles: input.tradingStyles,
      visibility: input.visibility,
      join_requirements: input.joinRequirements ?? {},
      owner_user_id: userId,
      member_count: 1,
    })
    .select('*')
    .single();
  if (error) throwIfMissing(error);

  const { error: memErr } = await db
    .from('squad_members')
    .insert({ squad_id: squad.id, user_id: userId, role: 'owner', status: 'active' });
  if (memErr) throwIfMissing(memErr);

  return mapRow(squad, true);
}

/**
 * Join a squad. `public` → active immediately; `request_to_join` → requested;
 * `private` / `invite_only` cannot be self-joined.
 */
export async function joinSquad(userId: string, squadId: string): Promise<{ status: SquadMemberStatus }> {
  const db = createAdminSupabase() as any;
  const { data: squad, error } = await db.from('squads').select('visibility').eq('id', squadId).maybeSingle();
  if (error) throwIfMissing(error);
  if (!squad) throw new Error('squad_not_found');

  const visibility = squad.visibility as SquadVisibility;
  if (visibility === 'private' || visibility === 'invite_only') {
    throw new Error('join_not_allowed');
  }
  const status: SquadMemberStatus = visibility === 'public' ? 'active' : 'requested';

  const { error: upErr } = await db
    .from('squad_members')
    .upsert({ squad_id: squadId, user_id: userId, role: 'member', status }, { onConflict: 'squad_id,user_id' });
  if (upErr) throwIfMissing(upErr);
  return { status };
}

/** Leave a squad (soft — status='left', member_count updates via trigger). */
export async function leaveSquad(userId: string, squadId: string): Promise<void> {
  const db = createAdminSupabase() as any;
  const { error } = await db
    .from('squad_members')
    .update({ status: 'left' })
    .eq('squad_id', squadId)
    .eq('user_id', userId);
  if (error) throwIfMissing(error);
}
