import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { listUserWallets } from '@/lib/db/userWallets';
import { getTotalPointsForUser, getPointsBreakdownForUser } from '@/lib/points/queries';
import {
  countReferralsForReferrer,
  sumReferralEarningsLamports,
} from '@/lib/referrals/earnings';
import { getReferralCodeRowForUser } from '@/lib/referrals/codes';
import { getCashbackBalanceSol } from '@/lib/db/adminEconomy';
import type { Tables } from '@/lib/supabase/types';

export type AdminUserSearchRow = {
  id: string;
  privy_id: string;
  wallet_address: string | null;
  username: string | null;
  email: string | null;
  tier_id: string;
  created_at: string;
};

/** Search users by id / privy_id / wallet / username / email (prefix + ilike). */
export async function searchUsers(query: string, limit = 25): Promise<AdminUserSearchRow[]> {
  const supabase = createAdminSupabase();
  const q = query.trim();
  const cols = 'id, privy_id, wallet_address, username, email, tier_id, created_at';

  if (!q) {
    const { data, error } = await supabase
      .from('users')
      .select(cols)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`searchUsers failed: ${error.message}`);
    return (data ?? []) as AdminUserSearchRow[];
  }

  // Exact id match short-circuit (id is a uuid column; ilike is invalid on it).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  if (isUuid) {
    const { data, error } = await supabase.from('users').select(cols).eq('id', q).limit(limit);
    if (error) throw new Error(`searchUsers failed: ${error.message}`);
    return (data ?? []) as AdminUserSearchRow[];
  }

  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await supabase
    .from('users')
    .select(cols)
    .or(
      [
        `wallet_address.ilike.${like}`,
        `username.ilike.${like}`,
        `email.ilike.${like}`,
        `privy_id.ilike.${like}`,
      ].join(','),
    )
    .limit(limit);
  if (error) throw new Error(`searchUsers failed: ${error.message}`);
  return (data ?? []) as AdminUserSearchRow[];
}

export type AdminUserProfile = {
  user: Tables<'users'>;
  wallets: Tables<'user_wallets'>[];
  points: { total: number; breakdown: Awaited<ReturnType<typeof getPointsBreakdownForUser>> };
  referrals: {
    code: string | null;
    referredCount: number;
    earningsLamports: number;
    unpaidLamports: number;
  };
  cashbackSol: number;
};

export async function getAdminUserProfile(userId: string): Promise<AdminUserProfile | null> {
  const supabase = createAdminSupabase();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`getAdminUserProfile failed: ${error.message}`);
  if (!user) return null;

  const [wallets, total, breakdown, code, referredCount, earnings, cashbackSol] = await Promise.all([
    listUserWallets(userId),
    getTotalPointsForUser(userId),
    getPointsBreakdownForUser(userId),
    getReferralCodeRowForUser(userId),
    countReferralsForReferrer(userId),
    sumReferralEarningsLamports(userId),
    getCashbackBalanceSol(userId).catch(() => 0),
  ]);

  return {
    user: user as Tables<'users'>,
    wallets,
    points: { total, breakdown },
    referrals: {
      code: code?.code ?? null,
      referredCount,
      earningsLamports: earnings.total,
      unpaidLamports: earnings.pending,
    },
    cashbackSol,
  };
}
