import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';
import type { AppChainId } from '@/lib/chains/appChain';
import { getUserById, updateUser } from '@/lib/db/users';
import { upsertTrackedWallet } from '@/lib/db/wallets';
import { STARTER_WALLET_PACKS } from '@/lib/trackers/starterWalletPacks';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export type TrackerGroupRow = Tables<'tracker_groups'>;

export async function listTrackerGroupsForUser(userId: string): Promise<TrackerGroupRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_groups')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listTrackerGroupsForUser failed: ${error.message}`);
  return data ?? [];
}

export async function insertTrackerGroup(
  row: TablesInsert<'tracker_groups'>,
): Promise<TrackerGroupRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('tracker_groups').insert(row).select('*').single();
  if (error) throw new Error(`insertTrackerGroup failed: ${error.message}`);
  return data;
}

/** One-time starter packs per chain — idempotent; repairs partial/empty group seeds. */
export async function ensureStarterTrackerGroups(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  let wallets: Awaited<ReturnType<typeof import('@/lib/db/wallets').listTrackedWalletsForUser>>;
  let groups: TrackerGroupRow[];
  try {
    const { listTrackedWalletsForUser } = await import('@/lib/db/wallets');
    [wallets, groups] = await Promise.all([
      listTrackedWalletsForUser(userId),
      listTrackerGroupsForUser(userId),
    ]);
  } catch {
    return;
  }

  const starterGroups = groups.filter((g) => g.is_starter);
  const starterWalletCount = wallets.filter(
    (w) => w.group_id && starterGroups.some((g) => g.id === w.group_id),
  ).length;

  if (wallets.length > 0 && starterWalletCount > 0) {
    if (!user.starter_trackers_seeded_at) {
      await updateUser(userId, { starter_trackers_seeded_at: new Date().toISOString() });
    }
    return;
  }

  for (const pack of STARTER_WALLET_PACKS) {
    let group = groups.find((g) => g.is_starter && g.slug === pack.slug);
    if (!group) {
      group = await insertTrackerGroup({
        user_id: userId,
        label: pack.label,
        app_chain: pack.chain,
        is_starter: true,
        slug: pack.slug,
        sort_order: pack.sortOrder,
      });
      groups = [...groups, group];
    }

    for (const w of pack.wallets) {
      const norm = normalizeWalletAddressForStorage(w.address);
      if (!norm) continue;
      await upsertTrackedWallet({
        user_id: userId,
        wallet_address: norm,
        label: w.label,
        notify: false,
        group_id: group.id,
      });
    }
  }

  await updateUser(userId, { starter_trackers_seeded_at: new Date().toISOString() });
}

export type TrackerGroupSummary = {
  id: string;
  label: string;
  appChain: AppChainId;
  isStarter: boolean;
  sortOrder: number;
  walletCount: number;
};

export function summarizeTrackerGroups(
  groups: TrackerGroupRow[],
  wallets: { group_id: string | null }[],
): TrackerGroupSummary[] {
  const counts = new Map<string, number>();
  for (const w of wallets) {
    if (!w.group_id) continue;
    counts.set(w.group_id, (counts.get(w.group_id) ?? 0) + 1);
  }
  return groups.map((g) => ({
    id: g.id,
    label: g.label,
    appChain: g.app_chain as AppChainId,
    isStarter: g.is_starter,
    sortOrder: g.sort_order,
    walletCount: counts.get(g.id) ?? 0,
  }));
}
