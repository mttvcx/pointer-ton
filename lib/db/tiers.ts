import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_AI_DAILY_QUOTA_USD,
  DEFAULT_PLATFORM_FEE_BPS,
  DEFAULT_TIER_ID,
} from '@/lib/utils/constants';
import type { Tables } from '@/lib/supabase/types';

/**
 * PHASE-5 SEAM
 * ============
 * `getFeeBpsForUser` and `getAIQuotaForUser` are the *only* places feature
 * code is allowed to ask "what's this user's fee/quota?". Phase 1 returns
 * the constant `default` tier values. Phase 5 swaps the function bodies to
 * read token holdings, points, etc. Call sites do not change.
 */

export type TierRow = Tables<'user_tiers'>;

const TIER_CACHE_MS = 60_000;
const tierCache = new Map<string, { row: TierRow; at: number }>();

async function getTier(tierId: string): Promise<TierRow> {
  const cached = tierCache.get(tierId);
  if (cached && Date.now() - cached.at < TIER_CACHE_MS) return cached.row;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_tiers')
    .select('*')
    .eq('id', tierId)
    .maybeSingle();
  if (error) throw new Error(`getTier(${tierId}) failed: ${error.message}`);

  // Fallback: in-memory default if the row is missing. Lets a fresh dev DB
  // function before the seed is applied.
  const row: TierRow = data ?? {
    id: DEFAULT_TIER_ID,
    name: 'Default',
    fee_bps: DEFAULT_PLATFORM_FEE_BPS,
    ai_quota_usd_daily: DEFAULT_AI_DAILY_QUOTA_USD,
    point_multiplier: 1,
  };

  tierCache.set(tierId, { row, at: Date.now() });
  return row;
}

async function tierForUser(userId: string): Promise<TierRow> {
  const supabase = createAdminSupabase();
  // Prefer `select('*')` over `select('tier_id')` so PostgREST does not reject
  // the request when its schema cache has not picked up a freshly migrated
  // column yet. Run `scripts/reload-postgrest-schema.sql` after DDL anyway.
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`tierForUser(${userId}) failed: ${error.message}`);
  const row = data as Tables<'users'> | null;
  const tierId = row?.tier_id ? String(row.tier_id) : DEFAULT_TIER_ID;
  return getTier(tierId);
}

/** Platform fee in basis points for the user's tier. */
export async function getFeeBpsForUser(userId: string): Promise<number> {
  const tier = await tierForUser(userId);
  return tier.fee_bps;
}

/** Daily AI spend ceiling in USD for the user's tier. */
export async function getAIQuotaForUser(userId: string): Promise<number> {
  const tier = await tierForUser(userId);
  return Number(tier.ai_quota_usd_daily);
}

/** Multiplier applied to user_points awards. Phase 5 makes this dynamic. */
export async function getPointMultiplierForUser(userId: string): Promise<number> {
  const tier = await tierForUser(userId);
  return Number(tier.point_multiplier);
}

/** Return the full tier row when callers need name / multiple fields. */
export async function getTierForUser(userId: string): Promise<TierRow> {
  return tierForUser(userId);
}

export async function listAllTiers(): Promise<TierRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_tiers')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw new Error(`listAllTiers failed: ${error.message}`);
  return data ?? [];
}
