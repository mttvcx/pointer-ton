import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  listUserWallets,
  syncLegacyUserWalletRow,
} from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  try {
    await syncLegacyUserWalletRow(user);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'sync_failed';
    console.warn('[wallets/my] syncLegacyUserWalletRow:', message);
  }

  try {
    const wallets = await listUserWallets(user.id);
    return NextResponse.json({
      wallets: wallets.map((w) => ({
        id: w.id,
        label: w.label,
        wallet_address: w.wallet_address,
        is_primary: w.is_primary,
        slot: w.slot,
        is_archived: w.is_archived,
        is_active: w.is_active,
        is_imported: w.is_imported,
        balance_lamports:
          w.balance_lamports != null ? String(w.balance_lamports) : null,
        balance_updated_at: w.balance_updated_at,
        created_at: w.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
