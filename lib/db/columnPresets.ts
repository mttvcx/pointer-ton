import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { Tables, TablesInsert } from '@/lib/supabase/types';
import { PULSE_COLUMNS, type PulseColumnId } from '@/lib/utils/constants';

export type ColumnPresetRow = Tables<'column_presets'>;

const DEFAULT_SORT_BY = 'created_at';
const DEFAULT_SORT_DIR = 'desc';

export async function ensureDefaultColumnPresets(userId: string): Promise<void> {
  const supabase = createAdminSupabase();
  for (const column_id of PULSE_COLUMNS) {
    const { data: existing, error: e1 } = await supabase
      .from('column_presets')
      .select('preset_slot')
      .eq('user_id', userId)
      .eq('column_id', column_id);
    if (e1) throw new Error(`ensureDefaultColumnPresets list failed: ${e1.message}`);
    const have = new Set((existing ?? []).map((r) => r.preset_slot));
    const inserts: TablesInsert<'column_presets'>[] = [];
    for (const preset_slot of [1, 2, 3] as const) {
      if (!have.has(preset_slot)) {
        inserts.push({
          user_id: userId,
          column_id,
          preset_slot,
          name: `P${preset_slot}`,
          filters: {} as Json,
          display_options: {} as Json,
          sort_by: DEFAULT_SORT_BY,
          sort_dir: DEFAULT_SORT_DIR,
        });
      }
    }
    if (inserts.length === 0) continue;
    const { error: e2 } = await supabase.from('column_presets').insert(inserts);
    if (e2) throw new Error(`ensureDefaultColumnPresets insert failed: ${e2.message}`);
  }
}

export async function listColumnPresetsForColumn(
  userId: string,
  columnId: PulseColumnId,
): Promise<ColumnPresetRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('column_presets')
    .select('*')
    .eq('user_id', userId)
    .eq('column_id', columnId)
    .order('preset_slot', { ascending: true });
  if (error) throw new Error(`listColumnPresetsForColumn failed: ${error.message}`);
  return data ?? [];
}

export async function getColumnPreset(
  userId: string,
  columnId: PulseColumnId,
  presetSlot: 1 | 2 | 3,
): Promise<ColumnPresetRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('column_presets')
    .select('*')
    .eq('user_id', userId)
    .eq('column_id', columnId)
    .eq('preset_slot', presetSlot)
    .maybeSingle();
  if (error) throw new Error(`getColumnPreset failed: ${error.message}`);
  return data;
}

export async function upsertColumnPreset(
  userId: string,
  columnId: PulseColumnId,
  presetSlot: 1 | 2 | 3,
  patch: {
    name?: string | null;
    filters?: Json;
    display_options?: Json;
    sort_by?: string;
    sort_dir?: string;
  },
): Promise<ColumnPresetRow> {
  const existing = await getColumnPreset(userId, columnId, presetSlot);
  const base: TablesInsert<'column_presets'> = {
    user_id: userId,
    column_id: columnId,
    preset_slot: presetSlot,
    name: existing?.name ?? `P${presetSlot}`,
    filters: (existing?.filters ?? {}) as Json,
    display_options: (existing?.display_options ?? {}) as Json,
    sort_by: existing?.sort_by ?? DEFAULT_SORT_BY,
    sort_dir: existing?.sort_dir ?? DEFAULT_SORT_DIR,
  };

  const merged: TablesInsert<'column_presets'> = {
    ...base,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.filters !== undefined ? { filters: patch.filters } : {}),
    ...(patch.display_options !== undefined ? { display_options: patch.display_options } : {}),
    ...(patch.sort_by !== undefined ? { sort_by: patch.sort_by } : {}),
    ...(patch.sort_dir !== undefined ? { sort_dir: patch.sort_dir } : {}),
  };

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('column_presets')
    .upsert(merged as TablesInsert<'column_presets'>, {
      onConflict: 'user_id,column_id,preset_slot',
    })
    .select('*')
    .single();
  if (error) throw new Error(`upsertColumnPreset failed: ${error.message}`);
  return data;
}

export async function applyColumnPresetToAllSlots(
  userId: string,
  columnId: PulseColumnId,
  source: {
    filters: Json;
    display_options: Json;
    sort_by: string;
    sort_dir: string;
  },
): Promise<void> {
  for (const presetSlot of [1, 2, 3] as const) {
    await upsertColumnPreset(userId, columnId, presetSlot, source);
  }
}
