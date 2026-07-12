import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Persistence for the Pointer Financial layer. The `financial_accounts` table +
 * migration are PENDING (DB restore + schema). Until it exists these helpers are
 * inert: reads return null, writes swallow errors — the routes still return the
 * live Bridge result, they just don't remember it yet. Same inert-until-schema
 * pattern as the social graph.
 */

export type FinancialAccountRow = {
  user_id: string;
  bridge_customer_id: string | null;
  bridge_card_id: string | null;
  card_last4: string | null;
  card_state: string | null;
  kyc_tier: number | null;
  card_in_wallet: boolean | null;
};

// The table isn't in the generated Supabase types yet, so we access it untyped.
function table() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createAdminSupabase() as any).from('financial_accounts');
}

export async function readFinancialAccount(userId: string): Promise<FinancialAccountRow | null> {
  try {
    const { data, error } = await table().select('*').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return (data as FinancialAccountRow) ?? null;
  } catch {
    return null;
  }
}

export async function saveFinancialAccount(row: FinancialAccountRow): Promise<void> {
  try {
    await table().upsert(row, { onConflict: 'user_id' });
  } catch {
    // inert until the table exists
  }
}
