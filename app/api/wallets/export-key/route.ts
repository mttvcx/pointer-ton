import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import { getUserWalletByAddress } from '@/lib/db/userWallets';
import { exportEmbeddedSolanaPrivateKey } from '@/lib/privy/exportEmbeddedWalletKey';
import { privyUserOwnsEmbeddedAddress } from '@/lib/privy/embeddedWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  wallet_address: z.string().min(32).max(128),
});

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
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  const row = await getUserWalletByAddress(user.id, normalized);
  if (!row || row.is_imported) {
    return NextResponse.json({ error: 'wallet_not_exportable' }, { status: 403 });
  }

  const owns = await privyUserOwnsEmbeddedAddress(
    verified.privyId,
    normalized,
    verified.walletAddress,
  );
  if (!owns) {
    return NextResponse.json({ error: 'wallet_not_allowed' }, { status: 403 });
  }

  try {
    const privateKey = await exportEmbeddedSolanaPrivateKey({
      privyId: verified.privyId,
      walletAddress: normalized,
      userAccessToken: accessToken,
    });
    return NextResponse.json({ private_key: privateKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'export_failed';
    console.warn('[wallets/export-key]', message);
    return NextResponse.json({ error: 'export_failed', message }, { status: 502 });
  }
}
