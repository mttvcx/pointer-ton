import 'server-only';

import { randomBytes } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type ReferralCodeRow = Tables<'referral_codes'>;

function randomSegment(len: number): string {
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i]! % ALPHABET.length]!;
  return s;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidVanityCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(code);
}

/** Short unambiguous code (8 chars). */
export function generateRandomReferralCode(): string {
  return randomSegment(8);
}

export async function getReferralCodeRowForUser(userId: string): Promise<ReferralCodeRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`getReferralCodeRowForUser: ${error.message}`);
  return data;
}

export async function getReferralCodeRowByCode(code: string): Promise<ReferralCodeRow | null> {
  const supabase = createAdminSupabase();
  const c = normalizeReferralCode(code);
  const { data, error } = await supabase.from('referral_codes').select('*').eq('code', c).maybeSingle();
  if (error) throw new Error(`getReferralCodeRowByCode: ${error.message}`);
  return data;
}

/**
 * Ensure the user has an active referral_codes row; collision-safe insert.
 */
export async function ensureDefaultReferralCode(userId: string): Promise<ReferralCodeRow> {
  const existing = await getReferralCodeRowForUser(userId);
  if (existing) return existing;

  const supabase = createAdminSupabase();
  for (let i = 0; i < 12; i++) {
    const insert: TablesInsert<'referral_codes'> = {
      code: generateRandomReferralCode(),
      user_id: userId,
      is_active: true,
      uses_count: 0,
    };
    const { data, error } = await supabase.from('referral_codes').insert(insert).select('*').single();
    if (!error && data) return data;
    if (error?.code !== '23505') throw new Error(`ensureDefaultReferralCode: ${error?.message}`);
  }
  throw new Error('ensureDefaultReferralCode: exhausted retries');
}

/**
 * Claim a vanity code; updates existing row or inserts.
 */
export async function claimVanityReferralCode(userId: string, desiredRaw: string): Promise<ReferralCodeRow> {
  const desired = normalizeReferralCode(desiredRaw);
  if (!isValidVanityCode(desired)) throw new Error('invalid_code');

  const supabase = createAdminSupabase();
  const current = await getReferralCodeRowForUser(userId);
  if (!current) {
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({ code: desired, user_id: userId, is_active: true, uses_count: 0 })
      .select('*')
      .single();
    if (error) throw new Error(`claimVanityReferralCode insert: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('referral_codes')
    .update({ code: desired })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(`claimVanityReferralCode update: ${error.message}`);
  return data;
}
