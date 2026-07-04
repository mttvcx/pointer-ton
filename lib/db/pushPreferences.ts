import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- push_preferences not in generated types */

import { createAdminSupabase } from '@/lib/supabase/server';

export type PushPreferences = {
  trackedWallet: boolean;
  xMonitor: boolean;
  price: boolean;
  autoBuyFill: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  trackedWallet: true,
  xMonitor: true,
  price: true,
  autoBuyFill: true,
};

export async function getPushPreferences(userId: string): Promise<PushPreferences> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('push_preferences')
    .select('tracked_wallet, x_monitor, price, auto_buy_fill')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache|42P01/i.test(error.message)) return DEFAULT_PUSH_PREFERENCES;
    throw new Error(error.message);
  }
  if (!data) return DEFAULT_PUSH_PREFERENCES;
  return {
    trackedWallet: data.tracked_wallet ?? true,
    xMonitor: data.x_monitor ?? true,
    price: data.price ?? true,
    autoBuyFill: data.auto_buy_fill ?? true,
  };
}

export async function upsertPushPreferences(
  userId: string,
  patch: Partial<PushPreferences>,
): Promise<PushPreferences> {
  const db = createAdminSupabase() as any;
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.trackedWallet !== undefined) row.tracked_wallet = patch.trackedWallet;
  if (patch.xMonitor !== undefined) row.x_monitor = patch.xMonitor;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.autoBuyFill !== undefined) row.auto_buy_fill = patch.autoBuyFill;

  const { error } = await db.from('push_preferences').upsert(row, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return getPushPreferences(userId);
}
