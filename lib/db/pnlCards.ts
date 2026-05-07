import 'server-only';

import { randomBytes } from 'crypto';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables } from '@/lib/supabase/types';

export type PnlCardRow = Tables<'pnl_cards'>;

function newShareToken(): string {
  return randomBytes(18).toString('base64url');
}

export async function findPnlCardByUserTrade(
  userId: string,
  tradeId: string,
): Promise<PnlCardRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pnl_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findPnlCardByUserTrade failed: ${error.message}`);
  return data;
}

export async function getPnlCardByShareToken(shareToken: string): Promise<PnlCardRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pnl_cards')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle();
  if (error) throw new Error(`getPnlCardByShareToken failed: ${error.message}`);
  return data;
}

export async function listPnlCardsForUser(
  userId: string,
  limit: number,
): Promise<PnlCardRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pnl_cards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPnlCardsForUser failed: ${error.message}`);
  return data ?? [];
}

export async function incrementPnlCardViewByShareToken(shareToken: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pnl_cards')
    .select('id, view_count')
    .eq('share_token', shareToken)
    .maybeSingle();
  if (error || !data) return;
  const next = (data.view_count ?? 0) + 1;
  const { error: upErr } = await supabase
    .from('pnl_cards')
    .update({ view_count: next })
    .eq('id', data.id);
  if (upErr) {
    console.warn('[pnl_cards] increment view failed:', upErr.message);
  }
}

export async function insertPnlCard(args: {
  user_id: string;
  trade_id: string;
  background_type?: string;
  background_preset?: string | null;
  background_url?: string | null;
  card_data: Json;
}): Promise<PnlCardRow> {
  const supabase = createAdminSupabase();
  let shareToken = newShareToken();
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase
      .from('pnl_cards')
      .insert({
        user_id: args.user_id,
        trade_id: args.trade_id,
        background_type: args.background_type ?? 'plain',
        background_preset: args.background_preset ?? null,
        background_url: args.background_url ?? null,
        card_data: args.card_data,
        share_token: shareToken,
      })
      .select('*')
      .single();
    if (!error && data) return data;
    const msg = error?.message?.toLowerCase() ?? '';
    if (msg.includes('duplicate') || msg.includes('unique')) {
      shareToken = newShareToken();
      continue;
    }
    throw new Error(`insertPnlCard failed: ${error?.message ?? 'unknown'}`);
  }
  throw new Error('insertPnlCard failed: could not allocate share_token');
}
