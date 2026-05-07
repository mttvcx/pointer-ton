import 'server-only';
import { subMinutes } from 'date-fns';
import { createAdminSupabase } from '@/lib/supabase/server';
import { PULSE_THRESHOLDS } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type TokenRow = Tables<'tokens'>;
export type TokenMarketSnapshotRow = Tables<'token_market_snapshots'>;
export type TokenHolderRow = Tables<'token_holders'>;
export type TokenEmbeddingRow = Tables<'token_embeddings'>;

export async function getTokenByMint(mint: string): Promise<TokenRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint', mint)
    .maybeSingle();
  if (error) throw new Error(`getTokenByMint failed: ${error.message}`);
  return data;
}

export async function getTokensByMints(mints: string[]): Promise<Map<string, TokenRow>> {
  const map = new Map<string, TokenRow>();
  if (mints.length === 0) return map;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('tokens').select('*').in('mint', mints);
  if (error) throw new Error(`getTokensByMints failed: ${error.message}`);
  for (const row of data ?? []) {
    map.set(row.mint, row);
  }
  return map;
}

/** Alias for AI pipeline naming (`explainToken` spec). */
export const getToken = getTokenByMint;

export async function upsertToken(
  row: TablesInsert<'tokens'>,
): Promise<TokenRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .upsert(row, { onConflict: 'mint' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertToken failed: ${error.message}`);
  return data;
}

export async function updateToken(
  mint: string,
  patch: TablesUpdate<'tokens'>,
): Promise<TokenRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .update(patch)
    .eq('mint', mint)
    .select('*')
    .single();
  if (error) throw new Error(`updateToken failed: ${error.message}`);
  return data;
}

export async function touchTokenLastSeen(mint: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('tokens')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('mint', mint);
  if (error) throw new Error(`touchTokenLastSeen failed: ${error.message}`);
}

export async function listRecentTokens(limit: number): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentTokens failed: ${error.message}`);
  return data ?? [];
}

export async function listTokensByCreatorWallet(
  wallet: string,
  limit: number,
): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('creator_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listTokensByCreatorWallet failed: ${error.message}`);
  return data ?? [];
}

export async function listPulseNewTokens(limit: number): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const since = subMinutes(new Date(), PULSE_THRESHOLDS.newMaxAgeMinutes).toISOString();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPulseNewTokens failed: ${error.message}`);
  return data ?? [];
}

export async function listPulseMigratedTokens(limit: number): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .not('migrated_at', 'is', null)
    .order('migrated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPulseMigratedTokens failed: ${error.message}`);
  return data ?? [];
}

/**
 * Stretch column: latest snapshot shows liquidity + holder count above Pulse
 * thresholds. We scan recent qualifying snapshots and dedupe by mint.
 */
export async function listPulseStretchTokens(limit: number): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const { data: snaps, error } = await supabase
    .from('token_market_snapshots')
    .select('mint, liquidity_usd, holder_count, snapshot_at')
    .gte('liquidity_usd', PULSE_THRESHOLDS.stretchMinLiquidityUsd)
    .gte('holder_count', PULSE_THRESHOLDS.stretchMinHolders)
    .order('snapshot_at', { ascending: false })
    .limit(400);
  if (error) throw new Error(`listPulseStretchTokens(snapshots) failed: ${error.message}`);

  const seen = new Set<string>();
  const mints: string[] = [];
  for (const s of snaps ?? []) {
    const row = s as { mint: string };
    if (seen.has(row.mint)) continue;
    seen.add(row.mint);
    mints.push(row.mint);
    if (mints.length >= limit) break;
  }
  if (mints.length === 0) return [];

  const { data: tokens, error: tErr } = await supabase
    .from('tokens')
    .select('*')
    .in('mint', mints);
  if (tErr) throw new Error(`listPulseStretchTokens(tokens) failed: ${tErr.message}`);
  const order = new Map(mints.map((m, i) => [m, i]));
  return (tokens ?? []).sort(
    (a, b) => (order.get(a.mint) ?? 999) - (order.get(b.mint) ?? 999),
  );
}

/** Map each mint to its most recent snapshot row (global sort desc, first wins). */
export async function getLatestSnapshotsForMints(
  mints: string[],
): Promise<Map<string, TokenMarketSnapshotRow>> {
  const map = new Map<string, TokenMarketSnapshotRow>();
  if (mints.length === 0) return map;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .in('mint', mints)
    .order('snapshot_at', { ascending: false });

  if (error) throw new Error(`getLatestSnapshotsForMints failed: ${error.message}`);
  for (const row of data ?? []) {
    if (!map.has(row.mint)) map.set(row.mint, row);
  }
  return map;
}

export async function bundlePulseTokens(tokens: TokenRow[]): Promise<PulseTokenBundle[]> {
  const mints = tokens.map((t) => t.mint);
  const snapshots = await getLatestSnapshotsForMints(mints);
  return tokens.map((token) => ({
    token,
    snapshot: snapshots.get(token.mint) ?? null,
  }));
}

/* ------------------------ token_market_snapshots ------------------------ */

export async function insertMarketSnapshot(
  row: TablesInsert<'token_market_snapshots'>,
): Promise<TokenMarketSnapshotRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertMarketSnapshot failed: ${error.message}`);
  return data;
}

export async function getLatestSnapshotForMint(
  mint: string,
): Promise<TokenMarketSnapshotRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .eq('mint', mint)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestSnapshotForMint failed: ${error.message}`);
  return data;
}

export async function listSnapshotsSince(
  mint: string,
  sinceIso: string,
): Promise<TokenMarketSnapshotRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .eq('mint', mint)
    .gte('snapshot_at', sinceIso)
    .order('snapshot_at', { ascending: true });
  if (error) throw new Error(`listSnapshotsSince failed: ${error.message}`);
  return data ?? [];
}

/** Ascending history for chart aggregation (cap for query size). */
export async function listSnapshotsForMintRange(
  mint: string,
  sinceIso: string,
  limit = 2000,
): Promise<TokenMarketSnapshotRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .eq('mint', mint)
    .gte('snapshot_at', sinceIso)
    .order('snapshot_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listSnapshotsForMintRange failed: ${error.message}`);
  return data ?? [];
}

/** Alias for AI pipelines (`explainToken`). */
export const getRecentSnapshots = listSnapshotsSince;

/* ----------------------------- token_holders ----------------------------- */

export async function replaceTopHolders(
  mint: string,
  rows: TablesInsert<'token_holders'>[],
): Promise<void> {
  const supabase = createAdminSupabase();
  const { error: delErr } = await supabase
    .from('token_holders')
    .delete()
    .eq('mint', mint);
  if (delErr) throw new Error(`replaceTopHolders(delete) failed: ${delErr.message}`);
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from('token_holders').insert(rows);
  if (insErr) throw new Error(`replaceTopHolders(insert) failed: ${insErr.message}`);
}

export async function listTopHolders(
  mint: string,
  limit: number,
): Promise<TokenHolderRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_holders')
    .select('*')
    .eq('mint', mint)
    .order('rank', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listTopHolders failed: ${error.message}`);
  return data ?? [];
}

/** Alias for `explainToken` / holder panels. */
export const getTopHolders = listTopHolders;

/* ---------------------------- token_embeddings --------------------------- */

export async function upsertTokenEmbedding(
  row: TablesInsert<'token_embeddings'>,
): Promise<TokenEmbeddingRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_embeddings')
    .upsert(row, { onConflict: 'mint' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertTokenEmbedding failed: ${error.message}`);
  return data;
}

export async function findSimilarTokensByEmbedding(
  _mint: string,
  _limit: number,
): Promise<{ mint: string; distance: number }[]> {
  void _mint;
  void _limit;
  // TODO Phase 3+: wire pgvector RPC `match_tokens` once defined in Supabase.
  return [];
}

/** Alias for `explainToken` lineage slot (pgvector later). */
export const getSimilarTokens = findSimilarTokensByEmbedding;
