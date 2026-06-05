import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { ConvertAssetId } from '@/lib/exchange/convertAssets';
import { buildConvertQuote } from '@/lib/exchange/convertQuote';
import { getUserByPrivyId } from '@/lib/db/users';
import { listUserWallets, userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { inferMintKind } from '@/lib/chains/mintKind';
import { PublicKey } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    fromAsset: z.enum(['SOL', 'USDC', 'BNB', 'ETH']),
    toAsset: z.enum(['SOL', 'USDC', 'BNB', 'ETH']),
    amountUi: z.number().positive().max(1_000_000),
    fromAddress: z.string().min(32),
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

  if (body.fromAsset === body.toAsset) {
    return NextResponse.json({ error: 'same_asset' }, { status: 400 });
  }

  if (inferMintKind(body.fromAddress) !== 'sol') {
    return NextResponse.json(
      { error: 'sol_wallet_required', message: 'Convert signing is wired for Solana wallets first.' },
      { status: 400 },
    );
  }

  let fromCanon: string;
  try {
    fromCanon = new PublicKey(body.fromAddress.trim()).toBase58();
  } catch {
    return NextResponse.json({ error: 'invalid_wallet' }, { status: 400 });
  }

  const tradeOk = await userCanUseWalletForTrading(user, fromCanon);
  if (!tradeOk) {
    return NextResponse.json({ error: 'wallet_not_allowed' }, { status: 403 });
  }

  try {
    const wallets = await listUserWallets(user.id);
    const quote = await buildConvertQuote({
      userId: user.id,
      fromAsset: body.fromAsset as ConvertAssetId,
      toAsset: body.toAsset as ConvertAssetId,
      amountUi: body.amountUi,
      fromAddress: fromCanon,
      wallets,
    });

    return NextResponse.json({ quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'quote_failed';
    const status = message === 'missing_destination_wallet' ? 400 : 502;
    return NextResponse.json({ error: 'quote_failed', message }, { status });
  }
}
