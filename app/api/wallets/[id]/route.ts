import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  getUserWalletById,
  setPrimaryUserWallet,
  updateUserWallet,
} from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z
  .object({
    label: z.string().min(1).max(64).nullable().optional(),
    is_primary: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'empty_patch' });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const row = await getUserWalletById(user.id, id);
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    let updated = row;
    const patch: {
      label?: string | null;
      is_archived?: boolean;
      is_active?: boolean;
    } = {};
    if (body.label !== undefined) patch.label = body.label;
    if (body.is_archived !== undefined) patch.is_archived = body.is_archived;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    if (Object.keys(patch).length > 0) {
      updated = await updateUserWallet(user.id, id, patch);
    }
    if (body.is_primary === true) {
      updated = await setPrimaryUserWallet(user.id, id);
    }

    return NextResponse.json({
      wallet: {
        id: updated.id,
        label: updated.label,
        wallet_address: updated.wallet_address,
        is_primary: updated.is_primary,
        slot: updated.slot,
        is_archived: updated.is_archived,
        is_active: updated.is_active,
        is_imported: updated.is_imported,
        balance_lamports:
          updated.balance_lamports != null ? String(updated.balance_lamports) : null,
        balance_updated_at: updated.balance_updated_at,
        created_at: updated.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    return NextResponse.json({ error: 'update_failed', message }, { status: 500 });
  }
}
