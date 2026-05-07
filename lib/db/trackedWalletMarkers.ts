import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TradeSide } from '@/lib/supabase/types';
import { listTrackedWalletsForUser } from '@/lib/db/wallets';
import { isValidPublicKey } from '@/lib/utils/addresses';

export type WalletChartMarkerRow = {
  walletAddress: string;
  trackerLabel: string | null;
  side: TradeSide;
  timeIso: string;
  txSignature: string;
};

type TradeRow = Tables<'trades'>;

/**
 * Confirmed Pointer trades on `mint` where the trader's linked wallet is in the viewer's
 * `tracked_wallets` list (matches `users.wallet_address` or any `user_wallets.wallet_address`).
 */
export async function listWalletMarkersForTrackedTradesOnMint(
  viewerUserId: string,
  mint: string,
  limit: number,
): Promise<WalletChartMarkerRow[]> {
  const tracked = await listTrackedWalletsForUser(viewerUserId);
  if (tracked.length === 0) return [];

  const trackedSet = new Set(tracked.map((t) => t.wallet_address));
  const labelByWallet = new Map<string, string | null>(
    tracked.map((t) => [t.wallet_address, t.label ?? null]),
  );

  const addresses = [...trackedSet].filter(isValidPublicKey);
  if (addresses.length === 0) return [];

  const supabase = createAdminSupabase();

  const [{ data: userHits }, { data: uwHits }] = await Promise.all([
    supabase.from('users').select('id').in('wallet_address', addresses),
    supabase.from('user_wallets').select('user_id').in('wallet_address', addresses),
  ]);

  const traderUserIds = new Set<string>();
  for (const r of userHits ?? []) traderUserIds.add(r.id);
  for (const r of uwHits ?? []) traderUserIds.add(r.user_id);

  const idList = [...traderUserIds];
  if (idList.length === 0) return [];

  const cap = Math.min(500, Math.max(1, limit));
  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint', mint)
    .in('user_id', idList)
    .eq('status', 'confirmed')
    .order('submitted_at', { ascending: false })
    .limit(cap);

  if (error) {
    throw new Error(`listWalletMarkersForTrackedTradesOnMint trades: ${error.message}`);
  }
  if (!trades?.length) return [];

  const [{ data: userRows }, { data: uwRows }] = await Promise.all([
    supabase.from('users').select('id, wallet_address').in('id', idList),
    supabase.from('user_wallets').select('user_id, wallet_address').in('user_id', idList),
  ]);

  const userIdToTrackedWallet = new Map<string, string>();
  for (const uid of idList) {
    const u = userRows?.find((r) => r.id === uid);
    const candidates: string[] = [];
    if (u?.wallet_address && isValidPublicKey(u.wallet_address)) {
      candidates.push(u.wallet_address);
    }
    for (const uw of uwRows ?? []) {
      if (uw.user_id === uid) candidates.push(uw.wallet_address);
    }
    for (const w of candidates) {
      if (trackedSet.has(w)) {
        userIdToTrackedWallet.set(uid, w);
        break;
      }
    }
  }

  const markers: WalletChartMarkerRow[] = [];
  for (const t of trades as TradeRow[]) {
    const w = userIdToTrackedWallet.get(t.user_id);
    if (!w) continue;
    markers.push({
      walletAddress: w,
      trackerLabel: labelByWallet.get(w) ?? null,
      side: t.side,
      timeIso: t.confirmed_at ?? t.submitted_at,
      txSignature: t.tx_signature,
    });
  }

  markers.sort((a, b) => new Date(a.timeIso).getTime() - new Date(b.timeIso).getTime());
  return markers;
}
