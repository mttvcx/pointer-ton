import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- device_push_tokens not in generated types until the social-schema migration is applied */

import { createAdminSupabase } from '@/lib/supabase/server';

export type DevicePushToken = { expoPushToken: string; platform: 'ios' | 'android' | null };

function isMissing(error: { message: string }): boolean {
  return /does not exist|schema cache|42P01/i.test(String(error.message));
}

/** Register (or refresh) an Expo push token for a user. Idempotent on the token. */
export async function upsertDevicePushToken(
  userId: string,
  expoPushToken: string,
  platform?: 'ios' | 'android' | null,
): Promise<void> {
  const db = createAdminSupabase() as any;
  const { error } = await db.from('device_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: platform ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' },
  );
  if (error) {
    if (isMissing(error)) throw new Error('missing_device_push_tokens_table');
    throw new Error(error.message);
  }
}

export async function deleteDevicePushToken(expoPushToken: string): Promise<void> {
  const db = createAdminSupabase() as any;
  await db.from('device_push_tokens').delete().eq('expo_push_token', expoPushToken);
}

export async function listDevicePushTokensForUser(userId: string): Promise<DevicePushToken[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('device_push_tokens')
    .select('expo_push_token, platform')
    .eq('user_id', userId);
  if (error) {
    if (isMissing(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as any[]).map((r) => ({
    expoPushToken: String(r.expo_push_token),
    platform: (r.platform ?? null) as 'ios' | 'android' | null,
  }));
}
