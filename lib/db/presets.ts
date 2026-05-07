import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type TradingPresetRow = Tables<'trading_presets'>;

const DEFAULTS: Omit<TablesInsert<'trading_presets'>, 'user_id'>[] = [
  {
    slot: 1,
    name: 'Fast',
    buy_amounts_sol: [0.1, 0.5, 1, 5],
    slippage_bps: 1_000,
    dynamic_slippage: true,
    priority_fee_lamports: 150_000,
    mev_mode: 'reduced',
    jito_tip_lamports: 200_000,
    auto_fee: true,
    max_fee_sol: 0.15,
  },
  {
    slot: 2,
    name: 'Normal',
    buy_amounts_sol: [0.1, 0.5, 1, 5],
    slippage_bps: 500,
    dynamic_slippage: true,
    priority_fee_lamports: 100_000,
    mev_mode: 'reduced',
    jito_tip_lamports: 100_000,
    auto_fee: true,
    max_fee_sol: 0.1,
  },
  {
    slot: 3,
    name: 'Safe',
    buy_amounts_sol: [0.05, 0.1, 0.5, 1],
    slippage_bps: 300,
    dynamic_slippage: true,
    priority_fee_lamports: 80_000,
    mev_mode: 'secure',
    jito_tip_lamports: 50_000,
    auto_fee: true,
    max_fee_sol: 0.08,
  },
];

function normalizeAmounts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [0.1, 0.5, 1, 5];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

/** Ensure three preset rows exist (idempotent). Call after user upsert. */
export async function ensureDefaultTradingPresets(userId: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { data: existing, error: e1 } = await supabase
    .from('trading_presets')
    .select('slot')
    .eq('user_id', userId);
  if (e1) throw new Error(`ensureDefaultTradingPresets list failed: ${e1.message}`);
  const have = new Set((existing ?? []).map((r) => r.slot));
  const inserts: TablesInsert<'trading_presets'>[] = [];
  for (const d of DEFAULTS) {
    if (!have.has(d.slot!)) {
      inserts.push({ ...d, user_id: userId });
    }
  }
  if (inserts.length === 0) return;
  const { error: e2 } = await supabase.from('trading_presets').insert(inserts);
  if (e2) throw new Error(`ensureDefaultTradingPresets insert failed: ${e2.message}`);
}

export async function getPresetsForUser(userId: string): Promise<TradingPresetRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trading_presets')
    .select('*')
    .eq('user_id', userId)
    .order('slot', { ascending: true });
  if (error) throw new Error(`getPresetsForUser failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    buy_amounts_sol: normalizeAmounts(row.buy_amounts_sol),
  })) as TradingPresetRow[];
}

export async function getPresetBySlot(
  userId: string,
  slot: 1 | 2 | 3,
): Promise<TradingPresetRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trading_presets')
    .select('*')
    .eq('user_id', userId)
    .eq('slot', slot)
    .maybeSingle();
  if (error) throw new Error(`getPresetBySlot failed: ${error.message}`);
  if (!data) return null;
  return { ...data, buy_amounts_sol: normalizeAmounts(data.buy_amounts_sol) } as TradingPresetRow;
}

export async function upsertPreset(
  userId: string,
  slot: 1 | 2 | 3,
  patch: TablesUpdate<'trading_presets'>,
): Promise<TradingPresetRow> {
  const existing = await getPresetBySlot(userId, slot);
  const template = DEFAULTS.find((d) => d.slot === slot)!;
  const base: TablesInsert<'trading_presets'> = {
    user_id: userId,
    slot,
    name: existing?.name ?? template.name ?? 'Preset',
    buy_amounts_sol: existing?.buy_amounts_sol ?? normalizeAmounts(template.buy_amounts_sol),
    slippage_bps: existing?.slippage_bps ?? template.slippage_bps ?? 500,
    dynamic_slippage: existing?.dynamic_slippage ?? template.dynamic_slippage ?? true,
    priority_fee_lamports:
      existing?.priority_fee_lamports ?? template.priority_fee_lamports ?? 100_000,
    mev_mode: existing?.mev_mode ?? template.mev_mode ?? 'reduced',
    jito_tip_lamports: existing?.jito_tip_lamports ?? template.jito_tip_lamports ?? 100_000,
    auto_fee: existing?.auto_fee ?? template.auto_fee ?? true,
    max_fee_sol: existing?.max_fee_sol ?? template.max_fee_sol ?? 0.1,
  };

  const merged: TablesInsert<'trading_presets'> = {
    ...base,
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.buy_amounts_sol != null
      ? { buy_amounts_sol: normalizeAmounts(patch.buy_amounts_sol) }
      : {}),
    ...(patch.slippage_bps != null ? { slippage_bps: patch.slippage_bps } : {}),
    ...(patch.dynamic_slippage != null ? { dynamic_slippage: patch.dynamic_slippage } : {}),
    ...(patch.priority_fee_lamports != null
      ? { priority_fee_lamports: patch.priority_fee_lamports }
      : {}),
    ...(patch.mev_mode != null ? { mev_mode: patch.mev_mode } : {}),
    ...(patch.jito_tip_lamports != null ? { jito_tip_lamports: patch.jito_tip_lamports } : {}),
    ...(patch.auto_fee != null ? { auto_fee: patch.auto_fee } : {}),
    ...(patch.max_fee_sol != null ? { max_fee_sol: patch.max_fee_sol } : {}),
  };

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trading_presets')
    .upsert(merged, { onConflict: 'user_id,slot' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertPreset failed: ${error.message}`);
  return { ...data, buy_amounts_sol: normalizeAmounts(data.buy_amounts_sol) } as TradingPresetRow;
}
