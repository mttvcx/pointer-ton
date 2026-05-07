import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  applyColumnPresetToAllSlots,
  ensureDefaultColumnPresets,
  listColumnPresetsForColumn,
  upsertColumnPreset,
} from '@/lib/db/columnPresets';
import { getUserByPrivyId } from '@/lib/db/users';
import type { Json } from '@/lib/supabase/types';
import {
  COLUMN_SORT_KEYS,
  ColumnDisplayOptionsSchema,
  ColumnFiltersSchema,
  normalizeColumnDisplayOptions,
  normalizeColumnFilters,
} from '@/lib/tokens/columnPresetModel';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PostSchema = z
  .object({
    column_id: z.enum(['new', 'stretch', 'migrated']),
    preset_slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    name: z.string().min(1).max(48).optional(),
    filters: ColumnFiltersSchema.optional(),
    display_options: ColumnDisplayOptionsSchema.optional(),
    sort_by: z.enum(COLUMN_SORT_KEYS).optional(),
    sort_dir: z.enum(['asc', 'desc']).optional(),
    apply_all_slots: z.boolean().optional(),
  })
  .strict();

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return { error: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }) };
  }
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return { error: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  const col = req.nextUrl.searchParams.get('column_id');
  if (col !== 'new' && col !== 'stretch' && col !== 'migrated') {
    return NextResponse.json({ error: 'invalid_column_id' }, { status: 400 });
  }
  try {
    let presets = await listColumnPresetsForColumn(r.user.id, col);
    if (presets.length === 0) {
      await ensureDefaultColumnPresets(r.user.id);
      presets = await listColumnPresetsForColumn(r.user.id, col);
    }
    return NextResponse.json({ presets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  let body: z.infer<typeof PostSchema>;
  try {
    const json: unknown = await req.json();
    body = PostSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }
  try {
    if (body.apply_all_slots) {
      const row = await listColumnPresetsForColumn(r.user.id, body.column_id);
      const cur =
        row.find((x) => x.preset_slot === body.preset_slot) ?? row[0] ?? null;
      const filters = body.filters ?? normalizeColumnFilters(cur?.filters);
      const display_options =
        body.display_options ?? normalizeColumnDisplayOptions(cur?.display_options);
      const sort_by = body.sort_by ?? cur?.sort_by ?? 'created_at';
      const sort_dir = body.sort_dir ?? cur?.sort_dir ?? 'desc';
      await applyColumnPresetToAllSlots(r.user.id, body.column_id, {
        filters: filters as unknown as Json,
        display_options: display_options as unknown as Json,
        sort_by,
        sort_dir,
      });
      const presets = await listColumnPresetsForColumn(r.user.id, body.column_id);
      return NextResponse.json({ presets });
    }

    const patch: {
      name?: string | null;
      filters?: Json;
      display_options?: Json;
      sort_by?: string;
      sort_dir?: string;
    } = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.filters !== undefined) patch.filters = body.filters as unknown as Json;
    if (body.display_options !== undefined)
      patch.display_options = body.display_options as unknown as Json;
    if (body.sort_by !== undefined) patch.sort_by = body.sort_by;
    if (body.sort_dir !== undefined) patch.sort_dir = body.sort_dir;

    const preset = await upsertColumnPreset(r.user.id, body.column_id, body.preset_slot, patch);
    return NextResponse.json({ preset });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
