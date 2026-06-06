import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/types';

export type WalletSignerProvisionRow = Tables<'wallet_signer_provisions'>;

export async function upsertWalletSignerProvision(input: {
  userId: string;
  walletAddress: string;
  privyWalletId?: string | null;
  status?: 'active' | 'revoked' | 'failed';
}): Promise<WalletSignerProvisionRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_signer_provisions')
    .upsert(
      {
        user_id: input.userId,
        wallet_address: input.walletAddress,
        privy_wallet_id: input.privyWalletId ?? null,
        status: input.status ?? 'active',
        provisioned_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,wallet_address' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(`upsertWalletSignerProvision failed: ${error?.message}`);
  return data;
}

export async function listSignerProvisionsForUser(userId: string): Promise<WalletSignerProvisionRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_signer_provisions')
    .select('*')
    .eq('user_id', userId)
    .order('provisioned_at', { ascending: false });
  if (error) throw new Error(`listSignerProvisionsForUser failed: ${error.message}`);
  return data ?? [];
}
