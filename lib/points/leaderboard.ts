import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { getRedis } from '@/lib/redis/client';
import type { Database } from '@/lib/supabase/types';

import type { LeaderboardEntry, LeaderboardPageResult } from '@/lib/points/leaderboardTypes';

export type { LeaderboardEntry, LeaderboardPageResult };

export type PointsLeaderboardRow = Database['public']['Views']['points_leaderboard']['Row'];

const CACHE_TTL_SEC = 120;
const CACHE_PREFIX = 'points_lb:v1';

/** Strip PostgREST `or()` metacharacters; keep alphanumerics for safe ilike. */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = globalThis.Number(v);
    return globalThis.Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeRow(raw: PointsLeaderboardRow): LeaderboardEntry {
  return {
    user_id: raw.user_id,
    username: raw.username,
    wallet_address: raw.wallet_address,
    total_points: num(raw.total_points),
    active_days: Math.round(num(raw.active_days)),
    rank: Math.round(num(raw.rank)),
  };
}

/**
 * Paginated leaderboard backed by `points_leaderboard` materialized view.
 * Podium is always the top 3 rows for the current filter. Table rows skip #1-#3.
 */
export async function fetchLeaderboardPage(input: {
  page: number;
  pageSize: number;
  query?: string;
  viewerUserId?: string | null;
}): Promise<LeaderboardPageResult> {
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const page = Math.max(1, input.page);
  const safe = sanitizeSearch((input.query ?? '').trim());
  const cacheKey = `${CACHE_PREFIX}:${page}:${pageSize}:${safe}:${
    input.viewerUserId ?? 'anon'
  }`;

  try {
    const redis = getRedis();
    const cached = await redis.get<LeaderboardPageResult>(cacheKey);
    if (cached) return cached;
  } catch {
    // Dev shim / transient Redis: continue uncached
  }

  const supabase = createAdminSupabase();
  let countQ = supabase.from('points_leaderboard').select('*', { count: 'exact', head: true });
  let podiumQ = supabase.from('points_leaderboard').select('*').order('rank', { ascending: true }).limit(3);

  let dataBase = supabase.from('points_leaderboard').select('*').order('rank', { ascending: true });

  if (safe) {
    const p = `%${safe}%`;
    const orExpr = `username.ilike.${p},wallet_address.ilike.${p}`;
    countQ = countQ.or(orExpr);
    podiumQ = podiumQ.or(orExpr);
    dataBase = dataBase.or(orExpr);
  }

  const youPromise = input.viewerUserId
    ? supabase.from('points_leaderboard').select('*').eq('user_id', input.viewerUserId).maybeSingle()
    : Promise.resolve({ data: null as PointsLeaderboardRow | null, error: null as null });

  const [countRes, podiumRes, youRes] = await Promise.all([countQ, podiumQ, youPromise]);

  if (countRes.error) throw new Error(`leaderboard count: ${countRes.error.message}`);
  if (podiumRes.error) throw new Error(`leaderboard podium: ${podiumRes.error.message}`);

  const total = countRes.count ?? 0;
  const tableTotal = Math.max(0, total - 3);
  const tablePages = tableTotal === 0 ? 0 : Math.ceil(tableTotal / pageSize);
  const effectivePage = tablePages > 0 ? Math.min(page, Math.max(1, tablePages)) : 1;
  const offset = 3 + (effectivePage - 1) * pageSize;
  const end = offset + pageSize - 1;

  let rows: LeaderboardEntry[] = [];
  if (tableTotal > 0 && offset <= total - 1) {
    const { data: tableRaw, error: tErr } = await dataBase.range(offset, end);
    if (tErr) throw new Error(`leaderboard page: ${tErr.message}`);
    rows = (tableRaw ?? []).map((r) => normalizeRow(r as PointsLeaderboardRow));
  }

  const podium = (podiumRes.data ?? []).map((r) => normalizeRow(r as PointsLeaderboardRow));

  const you =
    !input.viewerUserId || youRes.error || !youRes.data
      ? null
      : normalizeRow(youRes.data as PointsLeaderboardRow);

  const result: LeaderboardPageResult = {
    podium,
    rows,
    total,
    page: effectivePage,
    pageSize,
    tableTotal,
    tablePages,
    you,
  };

  try {
    const redis = getRedis();
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEC });
  } catch {
    // ignore cache write failure
  }

  return result;
}
