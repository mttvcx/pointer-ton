import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type IdentityProfileRow = Tables<'identity_profiles'>;
export type IdentityWalletRow = Tables<'identity_wallets'>;

const EVM_CHAINS = new Set(['eth', 'bnb', 'base']);

export function normalizeAddress(chain: string, address: string): string {
  const a = address.trim();
  // EVM addresses are case-insensitive; Solana/TON are case-sensitive base58/raw.
  return EVM_CHAINS.has(chain) ? a.toLowerCase() : a;
}

export function addressTypeForChain(chain: string): 'solana' | 'evm' {
  return EVM_CHAINS.has(chain) ? 'evm' : 'solana';
}

export async function createIdentityProfile(input: {
  displayName: string;
  twitterHandle?: string | null;
  telegramHandle?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  primaryCategory?: string;
  verified?: boolean;
}): Promise<IdentityProfileRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('identity_profiles')
    .insert({
      display_name: input.displayName,
      normalized_display_name: input.displayName.trim().toLowerCase(),
      twitter_handle: input.twitterHandle ?? null,
      telegram_handle: input.telegramHandle ?? null,
      website_url: input.websiteUrl ?? null,
      notes: input.notes ?? null,
      primary_category: input.primaryCategory ?? 'kol',
      verified: input.verified ?? false,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`createIdentityProfile failed: ${error?.message}`);
  return data;
}

export async function listIdentityProfiles(opts: { search?: string; limit?: number } = {}): Promise<IdentityProfileRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('identity_profiles').select('*').order('updated_at', { ascending: false });
  if (opts.search?.trim()) {
    const like = `%${opts.search.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
    q = q.ilike('normalized_display_name', like.toLowerCase());
  }
  q = q.limit(Math.min(200, Math.max(1, opts.limit ?? 100)));
  const { data, error } = await q;
  if (error) throw new Error(`listIdentityProfiles failed: ${error.message}`);
  return data ?? [];
}

export async function getIdentityProfile(id: string): Promise<IdentityProfileRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('identity_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getIdentityProfile failed: ${error.message}`);
  return data ?? null;
}

export async function updateIdentityProfile(
  id: string,
  patch: { displayName?: string; notes?: string | null; verified?: boolean; badges?: Json },
): Promise<IdentityProfileRow> {
  const supabase = createAdminSupabase();
  const update: Partial<TablesInsert<'identity_profiles'>> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.displayName !== undefined) {
    update.display_name = patch.displayName;
    update.normalized_display_name = patch.displayName.trim().toLowerCase();
  }
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.verified !== undefined) update.verified = patch.verified;
  if (patch.badges !== undefined) update.badges = patch.badges;
  const { data, error } = await supabase
    .from('identity_profiles')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new Error(`updateIdentityProfile failed: ${error?.message}`);
  return data;
}

export async function deleteIdentityProfile(id: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('identity_profiles').delete().eq('id', id);
  if (error) throw new Error(`deleteIdentityProfile failed: ${error.message}`);
}

export async function upsertIdentityWallet(input: {
  identityId: string;
  chain: string;
  address: string;
  label?: string | null;
  source: string;
  sourceUrl?: string | null;
  confidence?: number;
  verified?: boolean;
}): Promise<IdentityWalletRow> {
  const supabase = createAdminSupabase();
  const normalized = normalizeAddress(input.chain, input.address);
  const { data, error } = await supabase
    .from('identity_wallets')
    .upsert(
      {
        identity_id: input.identityId,
        chain: input.chain,
        address: input.address.trim(),
        normalized_address: normalized,
        address_type: addressTypeForChain(input.chain),
        label: input.label ?? null,
        source: input.source,
        source_url: input.sourceUrl ?? null,
        confidence: input.confidence ?? 0.75,
        verified: input.verified ?? false,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'chain,normalized_address' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(`upsertIdentityWallet failed: ${error?.message}`);
  return data;
}

export async function listIdentityWallets(identityId: string): Promise<IdentityWalletRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('identity_wallets')
    .select('*')
    .eq('identity_id', identityId)
    .order('last_seen_at', { ascending: false });
  if (error) throw new Error(`listIdentityWallets failed: ${error.message}`);
  return data ?? [];
}

export async function deleteIdentityWallet(id: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('identity_wallets').delete().eq('id', id);
  if (error) throw new Error(`deleteIdentityWallet failed: ${error.message}`);
}
