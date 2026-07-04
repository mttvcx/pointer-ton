import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- squads/squad_members not in generated types until the Phase 2 migration is applied */

import { randomUUID } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/server';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { initialsFromHandle } from '@/lib/squads/avatarTint';
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

/* ------------------------- discover card enrichment ------------------------- */

/** Card-shaped squad for the discover leaderboard — every stat derived from real
 *  member `wallet_stats`, never fabricated. Structurally matches the client
 *  `SquadSample` so the existing hero/compact cards render it unchanged. */
export type DiscoverSquadCard = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  emblem: string;
  pnl30d: number;
  pnlSparkline: number[];
  volume30d: number;
  memberCount: number;
  topMembers: string[];
  winRate: number;
  activeDays: number;
  tags: string[];
  ethosVerified: boolean;
  isPrivate: boolean;
  lastActiveLabel: string;
  chains: ('sol' | 'ton' | 'base' | 'bnb')[];
  followers: number;
  trustScore: number;
};

const TRADING_STYLE_LABELS: Record<TradingStyle, string> = {
  trenches: 'Trenches',
  perps: 'Perps',
  ai: 'AI',
  new_pairs: 'New pairs',
  wallets: 'Wallet copy',
  alerts: 'Alerts',
  long_term: 'Long term',
};

const CARD_CHAINS: ReadonlySet<string> = new Set(['sol', 'ton', 'base', 'bnb']);

function cardChains(chainFocus: ChainFocus[]): ('sol' | 'ton' | 'base' | 'bnb')[] {
  const out = chainFocus.filter((c): c is 'sol' | 'ton' | 'base' | 'bnb' => CARD_CHAINS.has(c));
  return out.length > 0 ? out : ['sol'];
}

function memberHandle(u: { username?: string | null; twitter_handle?: string | null; wallet_address?: string | null } | null): string {
  if (u?.username?.trim()) return u.username.trim();
  if (u?.twitter_handle?.trim()) return `@${u.twitter_handle.replace(/^@/, '')}`;
  if (u?.wallet_address?.trim()) return u.wallet_address.slice(0, 4);
  return '??';
}

type WalletStatRow = {
  wallet_address: string;
  pnl_usd_30d: number | null;
  win_rate_30d: number | null;
  total_volume_30d_usd: number | null;
  trades_30d: number | null;
  computed_at: string | null;
};

/**
 * Discover squads with real, member-derived stats for the leaderboard cards.
 * One grouped members query + one `wallet_stats` lookup — no per-squad fan-out.
 * Squads whose members have no computed stats surface honest zeros (win/pnl/vol
 * render as `—`/empty), never invented numbers.
 */
export async function listDiscoverSquadCards(userId: string, limit = 50): Promise<DiscoverSquadCard[]> {
  const summaries = await listDiscoverSquads(userId, limit);
  if (summaries.length === 0) return [];

  const db = createAdminSupabase() as any;
  const ids = summaries.map((s) => s.id);

  // All active members across every discover squad, with their linked identity.
  const { data: memberRows } = await db
    .from('squad_members')
    .select('squad_id, users(username, wallet_address, twitter_handle)')
    .in('squad_id', ids)
    .eq('status', 'active');

  const membersBySquad = new Map<string, Array<{ username?: string | null; wallet_address?: string | null; twitter_handle?: string | null }>>();
  const walletSet = new Set<string>();
  for (const m of (memberRows ?? []) as any[]) {
    const sid = String(m.squad_id);
    const u = m.users ?? null;
    if (!membersBySquad.has(sid)) membersBySquad.set(sid, []);
    membersBySquad.get(sid)!.push(u ?? {});
    if (u?.wallet_address) walletSet.add(String(u.wallet_address));
  }

  // Rolled-up per-wallet stats (30d) for every member wallet in one shot.
  const statByWallet = new Map<string, WalletStatRow>();
  if (walletSet.size > 0) {
    const { data: statRows } = await db
      .from('wallet_stats')
      .select('wallet_address, pnl_usd_30d, win_rate_30d, total_volume_30d_usd, trades_30d, computed_at')
      .in('wallet_address', Array.from(walletSet));
    for (const r of (statRows ?? []) as WalletStatRow[]) {
      statByWallet.set(String(r.wallet_address), r);
    }
  }

  const nowMs = Date.now();
  return summaries.map((s) => {
    const members = membersBySquad.get(s.id) ?? [];

    let pnl30d = 0;
    let volume30d = 0;
    let winWeighted = 0;
    let tradeTotal = 0;
    let latestComputed = 0;
    for (const m of members) {
      const stat = m.wallet_address ? statByWallet.get(String(m.wallet_address)) : undefined;
      if (!stat) continue;
      pnl30d += Number(stat.pnl_usd_30d ?? 0);
      volume30d += Number(stat.total_volume_30d_usd ?? 0);
      const trades = Number(stat.trades_30d ?? 0);
      if (trades > 0 && stat.win_rate_30d != null) {
        winWeighted += Number(stat.win_rate_30d) * trades;
        tradeTotal += trades;
      }
      if (stat.computed_at) {
        const t = Date.parse(stat.computed_at);
        if (Number.isFinite(t) && t > latestComputed) latestComputed = t;
      }
    }

    const winRate = tradeTotal > 0 ? Math.round(winWeighted / tradeTotal) : 0;
    // Explainable composite: mostly win-rate, lifted slightly by sustained activity.
    const activityLift = Math.min(20, Math.round(tradeTotal / 50));
    const trustScore = tradeTotal > 0 ? Math.min(100, Math.round(winRate * 0.8) + activityLift) : 0;

    const createdMs = Date.parse(s.createdAt);
    const activeDays = Number.isFinite(createdMs) ? Math.max(0, Math.floor((nowMs - createdMs) / 86_400_000)) : 0;
    const lastActiveLabel = latestComputed > 0 ? formatRelativeTime(latestComputed) : formatRelativeTime(s.createdAt);

    const topMembers = members
      .map((m) => memberHandle(m))
      .filter((h) => h !== '??')
      .map((h) => (h.length > 14 ? `${h.slice(0, 13)}…` : h))
      .slice(0, 5);

    return {
      id: s.id,
      handle: `@${s.slug}`,
      displayName: s.name,
      bio: s.description,
      emblem: initialsFromHandle(s.name || s.slug),
      pnl30d,
      pnlSparkline: [],
      volume30d,
      memberCount: s.memberCount,
      topMembers,
      winRate,
      activeDays,
      tags: s.tradingStyles.map((t) => TRADING_STYLE_LABELS[t] ?? t),
      ethosVerified: false,
      isPrivate: s.visibility !== 'public',
      lastActiveLabel,
      chains: cardChains(s.chainFocus),
      followers: 0,
      trustScore,
    };
  });
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
