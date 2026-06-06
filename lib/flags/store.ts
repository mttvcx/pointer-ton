import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type FeatureFlagRow = Tables<'feature_flags'>;

const FLAG_CACHE_MS = 30_000;
let cache: { map: Map<string, Json>; at: number } | null = null;

async function loadAll(): Promise<Map<string, Json>> {
  if (cache && Date.now() - cache.at < FLAG_CACHE_MS) return cache.map;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('feature_flags').select('key, value');
  if (error) throw new Error(`feature flags load failed: ${error.message}`);
  const map = new Map<string, Json>();
  for (const r of data ?? []) map.set(r.key, r.value);
  cache = { map, at: Date.now() };
  return map;
}

export function invalidateFlagCache() {
  cache = null;
}

/**
 * Resolve a boolean feature flag. Order of precedence:
 *   1. DB value (control-room managed)
 *   2. env var fallback (`envKey`) when provided
 *   3. `fallback` default
 */
export async function getBoolFlag(
  key: string,
  opts: { envKey?: string; fallback?: boolean } = {},
): Promise<boolean> {
  try {
    const map = await loadAll();
    if (map.has(key)) {
      const v = map.get(key);
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v === 'true' || v === '1';
      if (typeof v === 'number') return v !== 0;
    }
  } catch {
    /* fall through to env/default on DB error */
  }
  if (opts.envKey) {
    const raw = process.env[opts.envKey]?.trim();
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  }
  return opts.fallback ?? false;
}

export async function listFlags(): Promise<FeatureFlagRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('feature_flags').select('*').order('key');
  if (error) throw new Error(`listFlags failed: ${error.message}`);
  return data ?? [];
}

export async function upsertFlag(input: {
  key: string;
  value: Json;
  description?: string | null;
  allowProd?: boolean;
  updatedByUserId: string | null;
}): Promise<FeatureFlagRow> {
  const supabase = createAdminSupabase();
  const payload: TablesInsert<'feature_flags'> = {
    key: input.key,
    value: input.value,
    updated_by: input.updatedByUserId,
    updated_at: new Date().toISOString(),
  };
  if (input.description !== undefined) payload.description = input.description;
  if (input.allowProd !== undefined) payload.allow_prod = input.allowProd;
  const { data, error } = await supabase
    .from('feature_flags')
    .upsert(payload, { onConflict: 'key' })
    .select('*')
    .single();
  if (error || !data) throw new Error(`upsertFlag failed: ${error?.message}`);
  invalidateFlagCache();
  return data;
}

export async function getFlagRow(key: string): Promise<FeatureFlagRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('feature_flags').select('*').eq('key', key).maybeSingle();
  if (error) throw new Error(`getFlagRow failed: ${error.message}`);
  return data ?? null;
}
