import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

export type HeliusUsageInsert = {
  endpoint: string;
  credits_estimated: number;
  success: boolean;
  created_at?: string;
};

type UntypedDb = {
  from: (table: string) => {
    insert: (row: HeliusUsageInsert | HeliusUsageInsert[]) => Promise<{ error: { code?: string; message: string } | null }>;
    select: (cols: string) => {
      gte: (col: string, val: string) => Promise<{ data: HeliusUsageRow[] | null; error: { code?: string; message: string } | null }>;
    };
  };
};

export type HeliusUsageRow = {
  id: string;
  endpoint: string;
  credits_estimated: number;
  success: boolean;
  created_at: string;
};

function db(): UntypedDb {
  return createAdminSupabase() as unknown as UntypedDb;
}

export async function insertHeliusUsage(row: HeliusUsageInsert): Promise<void> {
  const { error } = await db().from('helius_usage').insert({
    endpoint: row.endpoint,
    credits_estimated: row.credits_estimated,
    success: row.success,
    created_at: row.created_at ?? new Date().toISOString(),
  });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return;
    throw new Error(`insertHeliusUsage failed: ${error.message}`);
  }
}

export async function listHeliusUsageSince(sinceIso: string): Promise<HeliusUsageRow[]> {
  const { data, error } = await db()
    .from('helius_usage')
    .select('id, endpoint, credits_estimated, success, created_at')
    .gte('created_at', sinceIso);
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(`listHeliusUsageSince failed: ${error.message}`);
  }
  return data ?? [];
}

export type HeliusUsageStats = {
  totalCreditsToday: number;
  byEndpoint: Array<{ endpoint: string; credits: number; calls: number }>;
  projectedMonthlyCredits: number;
  projectedMonthlyUsd: number;
};

/** USD per credit — mid-tier Helius list pricing (~$5 / 1M credits). */
export const HELIUS_USD_PER_CREDIT = 5 / 1_000_000;

export function aggregateHeliusUsageStats(rows: HeliusUsageRow[]): HeliusUsageStats {
  const byEndpointMap = new Map<string, { credits: number; calls: number }>();
  let totalCreditsToday = 0;

  for (const row of rows) {
    if (!row.success) continue;
    totalCreditsToday += row.credits_estimated;
    const cur = byEndpointMap.get(row.endpoint) ?? { credits: 0, calls: 0 };
    cur.credits += row.credits_estimated;
    cur.calls += 1;
    byEndpointMap.set(row.endpoint, cur);
  }

  const byEndpoint = [...byEndpointMap.entries()]
    .map(([endpoint, v]) => ({ endpoint, credits: v.credits, calls: v.calls }))
    .sort((a, b) => b.credits - a.credits);

  const projectedMonthlyCredits = Math.round(totalCreditsToday * 30);
  const projectedMonthlyUsd =
    Math.round(projectedMonthlyCredits * HELIUS_USD_PER_CREDIT * 100) / 100;

  return {
    totalCreditsToday,
    byEndpoint,
    projectedMonthlyCredits,
    projectedMonthlyUsd,
  };
}
