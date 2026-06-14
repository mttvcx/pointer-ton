import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/types';
import type { IdentitySeedRow } from '@/lib/identity/types';
import {
  appChainFromSeedChain,
  normalizeDisplayName,
  normalizeTwitterHandle,
  normalizeWalletAddress,
} from '@/lib/identity/normalize';
import { badgesForCategory } from '@/lib/identity/badges';
import { sourcePriority } from '@/lib/identity/config';

export type DbIdentityWalletRow = {
  chain: string;
  address: string;
  normalized_address: string;
  source: string;
  source_url: string | null;
  confidence: number;
  display_name: string;
  normalized_display_name: string;
  avatar_url: string | null;
  twitter_handle: string | null;
  telegram_handle: string | null;
  website_url: string | null;
  notes: string | null;
  primary_category: string;
  badges: string[];
  verified: boolean;
};

function mergeBadges(
  category: IdentitySeedRow['category'],
  badges?: IdentitySeedRow['badges'],
): string[] {
  const set = new Set<string>();
  for (const b of badgesForCategory(category ?? 'kol')) set.add(b);
  for (const b of badges ?? []) set.add(b);
  return [...set];
}

function seedToDbRow(row: IdentitySeedRow): DbIdentityWalletRow | null {
  const chain = appChainFromSeedChain(String(row.chain));
  if (!chain) return null;
  const { normalized, valid } = normalizeWalletAddress(chain, row.address);
  if (!valid) return null;
  const displayName = row.displayName.trim();
  if (!displayName) return null;
  return {
    chain,
    address: row.address.trim(),
    normalized_address: normalized,
    source: row.source,
    source_url: row.sourceUrl?.trim() || null,
    confidence: Math.min(1, Math.max(0, row.confidence ?? 0.75)),
    display_name: displayName,
    normalized_display_name: normalizeDisplayName(displayName),
    avatar_url: row.avatarUrl?.trim() || null,
    twitter_handle: normalizeTwitterHandle(row.twitterHandle),
    telegram_handle: row.telegramHandle?.trim() || null,
    website_url: row.websiteUrl?.trim() || null,
    notes: row.notes?.trim() || null,
    primary_category: row.category ?? 'kol',
    badges: mergeBadges(row.category ?? 'kol', row.badges),
    verified: Boolean(row.verified),
  };
}

/** Load all persisted identity wallets (for in-memory registry hydration). */
export async function loadIdentitySeedRowsFromDb(): Promise<IdentitySeedRow[]> {
  const supabase = createAdminSupabase();
  const { data: wallets, error: wErr } = await supabase.from('identity_wallets').select('*');
  if (wErr || !wallets?.length) {
    if (wErr) console.warn('[identity] load wallets failed:', wErr.message);
    return [];
  }

  const profileIds = [...new Set(wallets.map((w) => w.identity_id))];
  const { data: profiles, error: pErr } = await supabase
    .from('identity_profiles')
    .select('*')
    .in('id', profileIds);
  if (pErr || !profiles?.length) return [];

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const out: IdentitySeedRow[] = [];

  for (const row of wallets) {
    const profile = profileById.get(row.identity_id);
    if (!profile?.display_name) continue;
    out.push({
      chain: row.chain as IdentitySeedRow['chain'],
      address: row.address,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      twitterHandle: profile.twitter_handle,
      telegramHandle: profile.telegram_handle,
      websiteUrl: profile.website_url,
      notes: profile.notes,
      category: (profile.primary_category as IdentitySeedRow['category']) ?? 'kol',
      badges: Array.isArray(profile.badges)
        ? (profile.badges as IdentitySeedRow['badges'])
        : undefined,
      source: row.source,
      sourceUrl: row.source_url,
      confidence: row.confidence ?? 0.75,
      verified: row.verified ?? false,
    });
  }
  return out;
}

/** Upsert identity rows — dedupe by chain + normalized wallet address. */
export async function persistIdentitySeedRows(rows: IdentitySeedRow[]): Promise<{
  imported: number;
  skipped: number;
}> {
  const supabase = createAdminSupabase();
  let imported = 0;
  let skipped = 0;

  for (const seed of rows) {
    const dbRow = seedToDbRow(seed);
    if (!dbRow) {
      skipped += 1;
      continue;
    }

    const { data: existingWallet, error: lookupErr } = await supabase
      .from('identity_wallets')
      .select('id, identity_id, source')
      .eq('chain', dbRow.chain)
      .eq('normalized_address', dbRow.normalized_address)
      .maybeSingle();
    if (lookupErr) {
      skipped += 1;
      continue;
    }

    if (
      existingWallet &&
      sourcePriority(existingWallet.source) > sourcePriority(dbRow.source)
    ) {
      skipped += 1;
      continue;
    }

    let identityId = existingWallet?.identity_id ?? null;
    if (!identityId) {
      const profileInsert: TablesInsert<'identity_profiles'> = {
        display_name: dbRow.display_name,
        normalized_display_name: dbRow.normalized_display_name,
        avatar_url: dbRow.avatar_url,
        twitter_handle: dbRow.twitter_handle,
        telegram_handle: dbRow.telegram_handle,
        website_url: dbRow.website_url,
        notes: dbRow.notes,
        primary_category: dbRow.primary_category,
        badges: dbRow.badges,
        verified: dbRow.verified,
        source_priority: sourcePriority(dbRow.source),
        updated_at: new Date().toISOString(),
      };
      const { data: profile, error: profileErr } = await supabase
        .from('identity_profiles')
        .insert(profileInsert)
        .select('id')
        .single();
      if (profileErr || !profile) {
        skipped += 1;
        continue;
      }
      identityId = profile.id;
    } else {
      await supabase
        .from('identity_profiles')
        .update({
          display_name: dbRow.display_name,
          normalized_display_name: dbRow.normalized_display_name,
          avatar_url: dbRow.avatar_url,
          twitter_handle: dbRow.twitter_handle,
          telegram_handle: dbRow.telegram_handle,
          website_url: dbRow.website_url,
          notes: dbRow.notes,
          primary_category: dbRow.primary_category,
          badges: dbRow.badges,
          verified: dbRow.verified,
          source_priority: sourcePriority(dbRow.source),
          updated_at: new Date().toISOString(),
        })
        .eq('id', identityId);
    }

    const walletInsert: TablesInsert<'identity_wallets'> = {
      identity_id: identityId,
      chain: dbRow.chain,
      address: dbRow.address,
      normalized_address: dbRow.normalized_address,
      address_type: dbRow.chain === 'sol' ? 'solana' : 'evm',
      source: dbRow.source,
      source_url: dbRow.source_url,
      confidence: dbRow.confidence,
      verified: dbRow.verified,
      last_seen_at: new Date().toISOString(),
    };

    const { error: walletErr } = await supabase.from('identity_wallets').upsert(walletInsert, {
      onConflict: 'chain,normalized_address',
    });
    if (walletErr) {
      skipped += 1;
      continue;
    }
    imported += 1;
  }

  return { imported, skipped };
}

export async function countIdentityRegistryRows(): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('identity_wallets')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}
