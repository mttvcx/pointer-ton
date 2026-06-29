import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId, type UserRow } from '@/lib/db/users';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { liveCommerceActive } from '@/lib/packs/commerce';
import { getPacksTreasuryPubkey } from '@/lib/packs/treasury';
import { resolvePackConfigAtMarket } from '@/lib/packs/packConfig';
import { getConnection } from '@/lib/solana/connection';
import { solToLamports } from '@/lib/utils/formatters';
import type { PackType } from '@/types/pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    packType: z.enum(['bronze', 'silver', 'gold', 'legendary']),
    userWallet: z.string().min(32).max(64),
  })
  .strict();

/**
 * Build the unsigned SOL-transfer that pays a pack's price to the treasury.
 * The client signs + sends it (Privy), then calls /api/packs/open with the
 * resulting signature. Mirrors the trade quote→sign→execute split.
 */
export async function POST(req: NextRequest) {
  if (!liveCommerceActive()) {
    return NextResponse.json({ error: 'live_commerce_disabled' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let user: UserRow;
  try {
    const verified = await verifyPrivyAccessToken(accessToken);
    const found = await getUserByPrivyId(verified.privyId);
    if (!found) return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
    user = found;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  // Per-user account freeze (fail-closed) — paying for a pack moves funds.
  const frozen = await accountFreezeGateOrNull(user.id, 'trading');
  if (frozen) return frozen;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  let payerPk: PublicKey;
  try {
    payerPk = new PublicKey(body.userWallet.trim());
  } catch {
    return NextResponse.json({ error: 'invalid_wallet' }, { status: 400 });
  }

  const allowed = await userCanUseWalletForTrading(user, payerPk.toBase58());
  if (!allowed) {
    return NextResponse.json({ error: 'wallet_not_allowed' }, { status: 403 });
  }

  const treasury = getPacksTreasuryPubkey();
  if (!treasury) {
    return NextResponse.json({ error: 'treasury_not_configured' }, { status: 503 });
  }

  let resolved: Awaited<ReturnType<typeof resolvePackConfigAtMarket>>;
  try {
    resolved = await resolvePackConfigAtMarket(body.packType as PackType);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pack_invalid';
    return NextResponse.json({ error: 'pack_invalid', message }, { status: 400 });
  }

  const amountLamports = Number(solToLamports(resolved.config.packPriceSol));

  let blockhash: string;
  try {
    ({ blockhash } = await getConnection().getLatestBlockhash('confirmed'));
  } catch {
    return NextResponse.json({ error: 'blockhash_unavailable' }, { status: 503 });
  }

  const message = new TransactionMessage({
    payerKey: payerPk,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payerPk,
        toPubkey: treasury,
        lamports: amountLamports,
      }),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  const paymentTransaction = Buffer.from(tx.serialize()).toString('base64');

  return NextResponse.json({
    paymentTransaction,
    amountLamports,
    packPriceSol: resolved.config.packPriceSol,
    treasury: treasury.toBase58(),
    userId: user.id,
  });
}
