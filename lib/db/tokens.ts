import 'server-only';
import { subHours, subMinutes } from 'date-fns';
import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { tokenMatchesAppChain } from '@/lib/chains/evmTokenChain';
import { createAdminSupabase } from '@/lib/supabase/server';
import { withSupabaseRetry } from '@/lib/db/supabaseRetry';
import { PULSE_THRESHOLDS, type PulseColumnId, type MigrationDestination } from '@/lib/utils/constants';
import { PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { dedupeTokenRowsByMint } from '@/lib/tokens/dedupePulseTokens';
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
  return withSupabaseRetry('listRecentTokens', async () => {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listRecentTokens failed: ${error.message}`);
    return data ?? [];
  });
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
 * Stretch column: bonding curve ≥ {@link PULSE_NEAR_MIGRATE_PCT}%, not migrated,
 * created within the stretch window (Axiom-style final stretch).
 */
export async function listPulseStretchTokens(limit: number): Promise<TokenRow[]> {
  return resolvePulseStretchTokens(limit);
}

/** Mark a token as migrated to PumpSwap / Raydium / Meteora (idempotent). */
export async function markTokenMigrated(
  mint: string,
  migratedTo: MigrationDestination,
  migratedAt?: string,
): Promise<TokenRow | null> {
  const existing = await getTokenByMint(mint);
  if (!existing) return null;
  const at = migratedAt ?? new Date().toISOString();
  if (existing.migrated_at) {
    if (!existing.migrated_to) {
      return updateToken(mint, { migrated_to: migratedTo, last_seen_at: at });
    }
    return existing;
  }
  return updateToken(mint, {
    migrated_at: at,
    migrated_to: migratedTo,
    bonding_progress: 100,
    last_seen_at: at,
  });
}

/** Scan deeper than {@link listPulseNewTokens}: avoid empty Pulse columns when recent rows are mostly other chains. */
const PULSE_FEED_SCAN_DEPTH = 4000;

function isMissingBondingProgressColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /bonding_progress.*does not exist|42703.*bonding_progress/i.test(msg);
}

/** Legacy stretch heuristic: recent, unmigrated tokens with snapshot liquidity + holders. */
async function listPulseStretchBySnapshotHeuristic(
  limit: number,
  chain?: AppChainId,
): Promise<TokenRow[]> {
  const since = subHours(new Date(), PULSE_THRESHOLDS.stretchMaxAgeHours).toISOString();
  const recent = await listRecentTokens(PULSE_FEED_SCAN_DEPTH);
  let candidates = recent.filter((t) => t.migrated_at == null && t.created_at >= since);
  if (chain) {
    candidates = candidates.filter((t) => tokenMatchesAppChain(t, chain));
  }
  if (candidates.length === 0) return [];

  const snapshots = await getLatestSnapshotsForMints(candidates.map((t) => t.mint));
  const qualified = candidates.filter((t) => {
    const snap = snapshots.get(t.mint);
    if (!snap) return false;
    const holders = snap.holder_count ?? 0;
    const liq = Number(snap.liquidity_usd) || 0;
    return (
      holders >= PULSE_THRESHOLDS.stretchMinHolders &&
      liq >= PULSE_THRESHOLDS.stretchMinLiquidityUsd
    );
  });

  qualified.sort((a, b) => {
    const la = Number(snapshots.get(a.mint)?.liquidity_usd) || 0;
    const lb = Number(snapshots.get(b.mint)?.liquidity_usd) || 0;
    if (lb !== la) return lb - la;
    return b.created_at.localeCompare(a.created_at);
  });

  return qualified.slice(0, limit);
}

async function listPulseStretchByBondingProgress(limit: number): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();
  const since = subHours(new Date(), PULSE_THRESHOLDS.stretchMaxAgeHours).toISOString();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .gte('bonding_progress', PULSE_NEAR_MIGRATE_PCT)
    .is('migrated_at', null)
    .gte('created_at', since)
    .order('bonding_progress', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPulseStretchTokens failed: ${error.message}`);
  return data ?? [];
}

async function resolvePulseStretchTokens(limit: number, chain?: AppChainId): Promise<TokenRow[]> {
  try {
    const scanLimit = chain ? Math.max(limit, 1200) : limit;
    const bondingRows = await listPulseStretchByBondingProgress(scanLimit);
    const filtered = chain
      ? bondingRows.filter((t) => tokenMatchesAppChain(t, chain))
      : bondingRows;
    if (filtered.length > 0) return filtered.slice(0, limit);
  } catch (err) {
    if (!isMissingBondingProgressColumnError(err)) throw err;
  }
  return listPulseStretchBySnapshotHeuristic(limit, chain);
}

/**
 * Pulse column feed scoped to `chain`. Queries a wide candidate set then filters by
 * {@link mintMatchesAppChain} so SOL/BNB/Base aren’t starved when TON fills the latest slots.
 */
export async function listPulseFeedTokens(
  column: PulseColumnId,
  chain: AppChainId,
  limit: number,
): Promise<TokenRow[]> {
  const supabase = createAdminSupabase();

  if (column === 'new') {
    const since = subMinutes(new Date(), PULSE_THRESHOLDS.newMaxAgeMinutes).toISOString();
    const recent = await listRecentTokens(PULSE_FEED_SCAN_DEPTH);
    return dedupeTokenRowsByMint(
      recent
        .filter((t) => t.created_at >= since && tokenMatchesAppChain(t, chain))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    ).slice(0, limit);
  }

  if (column === 'migrated') {
    return withSupabaseRetry(`listPulseFeedTokens(${column})`, async () => {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .not('migrated_at', 'is', null)
        .order('migrated_at', { ascending: false })
        .limit(1200);
      if (error) throw new Error(`listPulseFeedTokens(migrated) failed: ${error.message}`);
      return dedupeTokenRowsByMint(
        (data ?? []).filter((t) => tokenMatchesAppChain(t, chain)),
      ).slice(0, limit);
    });
  }

  return withSupabaseRetry(`listPulseFeedTokens(${column})`, async () => {
    return resolvePulseStretchTokens(limit, chain);
  });
}

/** Map each mint to its most recent snapshot row (global sort desc, first wins). */
export async function getLatestSnapshotsForMints(
  mints: string[],
): Promise<Map<string, TokenMarketSnapshotRow>> {
  const map = new Map<string, TokenMarketSnapshotRow>();
  if (mints.length === 0) return map;

  const supabase = createAdminSupabase();
  const uniqueMints = [...new Set(mints)];
  const batchSize = 150;

  for (let i = 0; i < uniqueMints.length; i += batchSize) {
    const batch = uniqueMints.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('token_market_snapshots')
      .select('*')
      .in('mint', batch)
      .order('snapshot_at', { ascending: false });

    if (error) throw new Error(`getLatestSnapshotsForMints failed: ${error.message}`);
    for (const row of data ?? []) {
      if (!map.has(row.mint)) map.set(row.mint, row);
    }
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

const EXPLORE_SNAPSHOT_SCAN = 2000;

/**
 * Ranked “top” view for Explore: latest snapshot per mint (recency), then sort by 24h volume,
 * keep mints that match the header chain (`mintMatchesAppChain`).
 */
export async function listExploreTopBundlesForChain(
  chain: AppChainId,
  limit: number,
): Promise<PulseTokenBundle[]> {
  const cap = Math.min(Math.max(limit, 1), 100);
  const supabase = createAdminSupabase();

  const { data: snaps, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(EXPLORE_SNAPSHOT_SCAN);

  if (error) throw new Error(`listExploreTopBundlesForChain(snapshots) failed: ${error.message}`);

  const latestByMint = new Map<string, TokenMarketSnapshotRow>();
  for (const row of snaps ?? []) {
    const s = row as TokenMarketSnapshotRow;
    if (!latestByMint.has(s.mint)) latestByMint.set(s.mint, s);
  }

  const ranked = [...latestByMint.values()].sort((a, b) => {
    const va = Number(a.volume_24h_usd) || 0;
    const vb = Number(b.volume_24h_usd) || 0;
    if (vb !== va) return vb - va;
    const ma = Number(a.market_cap_usd) || 0;
    const mb = Number(b.market_cap_usd) || 0;
    return mb - ma;
  });

  const mintCandidates = ranked.map((s) => s.mint);
  if (mintCandidates.length === 0) return [];

  const { data: tokens, error: tErr } = await supabase
    .from('tokens')
    .select('*')
    .in('mint', mintCandidates.slice(0, cap * 4));
  if (tErr) throw new Error(`listExploreTopBundlesForChain(tokens) failed: ${tErr.message}`);

  const byMint = new Map((tokens ?? []).map((t) => [t.mint, t]));
  const bundles: PulseTokenBundle[] = [];
  for (const s of ranked) {
    const token = byMint.get(s.mint);
    if (!token || !tokenMatchesAppChain(token, chain)) continue;
    bundles.push({ token, snapshot: s });
    if (bundles.length >= cap) break;
  }
  return bundles;
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
