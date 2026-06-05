import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  countUserWallets,
  getUserWalletByAddress,
  insertUserWallet,
} from '@/lib/db/userWallets';
import { privyUserOwnsEmbeddedAddress } from '@/lib/privy/embeddedWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    wallet_address: z.string().min(1),
    label: z.string().min(1).max(64).nullable().optional(),
    is_imported: z.boolean().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
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

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const normalized = normalizeWalletAddressForStorage(body.wallet_address);
  if (!normalized) {
    return NextResponse.json(
      { error: 'invalid_wallet_address', message: 'Not a valid TON, Solana, or EVM address' },
      { status: 400 },
    );
  }

  if (body.is_imported !== true) {
    const owned = await privyUserOwnsEmbeddedAddress(
      verified.privyId,
      normalized,
      verified.walletAddress,
    );
    if (!owned) {
      return NextResponse.json(
        {
          error: 'wallet_not_linked',
          message: 'Address must match your connected wallet for this sign-in session',
        },
        { status: 403 },
      );
    }
  }

  const dup = await getUserWalletByAddress(user.id, normalized);
  if (dup) {
    return NextResponse.json(
      { error: 'duplicate_wallet', wallet: dup },
      { status: 409 },
    );
  }

  const n = await countUserWallets(user.id);
  try {
    const row = await insertUserWallet({
      user_id: user.id,
      wallet_address: normalized,
      label: body.label ?? (n === 0 ? 'Primary' : `Wallet ${n + 1}`),
      is_primary: n === 0,
      slot: n,
      is_archived: false,
      is_active: true,
      is_imported: body.is_imported === true,
    });

    return NextResponse.json({
      wallet: {
        id: row.id,
        label: row.label,
        wallet_address: row.wallet_address,
        is_primary: row.is_primary,
        slot: row.slot,
        is_archived: row.is_archived,
        is_active: row.is_active,
        is_imported: row.is_imported,
        balance_lamports:
          row.balance_lamports != null ? String(row.balance_lamports) : null,
        balance_updated_at: row.balance_updated_at,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'insert_failed';
    return NextResponse.json({ error: 'insert_failed', message }, { status: 500 });
  }
}
