import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { AiScanType } from '@/lib/ai/scanCacheKeys';

export type AiScanCacheRow = {
  cache_key: string;
  result: Json;
  model_used: string;
  created_at: string;
  expires_at: string;
  hit_count: number;
  source_mint: string | null;
  source_wallet: string | null;
  mc_at_scan: number | null;
  scan_type: string;
};

type UntypedDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: AiScanCacheRow | null; error: { code?: string; message: string } | null }>;
        single: () => Promise<{ data: AiScanCacheRow; error: { message: string } | null }>;
      };
      gte: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: AiScanCacheRow[] | null; error: { code?: string; message: string } | null }> };
      };
    };
    upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    update: (row: unknown) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
    delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
  rpc: (fn: string, args: Record<string, string>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

function db(): UntypedDb {
  return createAdminSupabase() as unknown as UntypedDb;
}

export async function getAiScanCacheRow(cacheKey: string): Promise<AiScanCacheRow | null> {
  const { data, error } = await db().from('ai_scan_cache').select('*').eq('cache_key', cacheKey).maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(`getAiScanCacheRow failed: ${error.message}`);
  }
  return data;
}

export async function upsertAiScanCacheRow(input: {
  cache_key: string;
  result: unknown;
  model_used: string;
  expires_at: string;
  scan_type: AiScanType;
  source_mint?: string | null;
  source_wallet?: string | null;
  mc_at_scan?: number | null;
}): Promise<void> {
  const { error } = await db().from('ai_scan_cache').upsert(
    {
      cache_key: input.cache_key,
      result: input.result as Json,
      model_used: input.model_used,
      expires_at: input.expires_at,
      scan_type: input.scan_type,
      source_mint: input.source_mint ?? null,
      source_wallet: input.source_wallet ?? null,
      mc_at_scan: input.mc_at_scan ?? null,
      hit_count: 0,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' },
  );
  if (error) throw new Error(`upsertAiScanCacheRow failed: ${error.message}`);
}

export async function incrementAiScanCacheHit(cacheKey: string): Promise<number | null> {
  const { data, error } = await db().rpc('increment_ai_scan_cache_hit', { p_cache_key: cacheKey });
  if (error) {
    if (error.code === '42883' || error.code === '42P01' || error.code === 'PGRST202') {
      const row = await getAiScanCacheRow(cacheKey);
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
      const next = row.hit_count + 1;
      const { error: updErr } = await db()
        .from('ai_scan_cache')
        .update({ hit_count: next })
        .eq('cache_key', cacheKey);
      if (updErr) return null;
      return next;
    }
    console.warn('[ai-scan-cache] increment hit failed', error.message);
    return null;
  }
  return typeof data === 'number' ? data : null;
}

export async function deleteAiScanCacheRow(cacheKey: string): Promise<void> {
  const { error } = await db().from('ai_scan_cache').delete().eq('cache_key', cacheKey);
  if (error) throw new Error(`deleteAiScanCacheRow failed: ${error.message}`);
}

export async function listTopAiScanCacheByHitsToday(limit = 20): Promise<AiScanCacheRow[]> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const chain = db().from('ai_scan_cache').select('*').gte('created_at', start.toISOString());
  const { data, error } = await chain.order('hit_count', { ascending: false }).limit(limit);
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(`listTopAiScanCacheByHitsToday failed: ${error.message}`);
  }
  return data ?? [];
}

export async function getAiScanCacheStatsToday(): Promise<{
  entries: number;
  totalHits: number;
  misses: number;
}> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const chain = db().from('ai_scan_cache').select('*').gte('created_at', start.toISOString());
  const { data, error } = await chain.order('hit_count', { ascending: false }).limit(10_000);
  if (error) {
    if (error.code === '42P01') return { entries: 0, totalHits: 0, misses: 0 };
    throw new Error(`getAiScanCacheStatsToday failed: ${error.message}`);
  }
  const rows = data ?? [];
  const totalHits = rows.reduce((s, r) => s + (r.hit_count ?? 0), 0);
  return { entries: rows.length, totalHits, misses: rows.length };
}
