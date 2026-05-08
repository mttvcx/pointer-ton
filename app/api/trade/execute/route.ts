import { createHash, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getFeeBpsForUser } from '@/lib/db/tiers';
import { countConfirmedTradesForUser, insertTrade } from '@/lib/db/trades';
import { getUserByPrivyId } from '@/lib/db/users';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { awardPoints } from '@/lib/points/award';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { recordReferralEarningFromTrade } from '@/lib/referrals/earnings';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { lamportsToSol, solToLamports } from '@/lib/utils/formatters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tonAddr = z.string().refine((s) => Boolean(normalizeTonAddress(s)), 'invalid_ton_address');

const ExecuteBodySchema = z
  .object({
    /** TonConnect `sendTransaction` result: signed external-message BOC (base64). */
    signedTransaction: z.string().min(80),
    userPublicKey: tonAddr,
    mint: tonAddr,
    side: z.enum(['buy', 'sell']),
    amountInRaw: z.string().regex(/^\d+$/),
    amountOutRaw: z.string().regex(/^\d+$/),
    /** Quote summary SOL notional for points + fee estimate (optional; derived from raw if omitted). */
    amountSolNotional: z.number().nonnegative().optional(),
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

  let body: z.infer<typeof ExecuteBodySchema>;
  try {
    const json: unknown = await req.json();
    body = ExecuteBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const walletCanon = normalizeTonAddress(body.userPublicKey)!;
  const mintCanon = normalizeTonAddress(body.mint)!;

  const tradeOk = await userCanUseWalletForTrading(user, walletCanon);
  if (!tradeOk) {
    return NextResponse.json(
      {
        error: 'wallet_not_allowed',
        message: 'This wallet cannot trade in Pointer (imported keys are view-only until Phase 5)',
      },
      { status: 403 },
    );
  }

  let serialized: Buffer;
  try {
    serialized = Buffer.from(body.signedTransaction, 'base64');
    if (serialized.length < 32) throw new Error('short_boc');
  } catch {
    return NextResponse.json({ error: 'invalid_transaction_encoding' }, { status: 400 });
  }

  /** Stable id for DB + points; wallet has already broadcast via TonConnect. */
  const txSignature = `ton:${createHash('sha256').update(serialized).digest('hex')}`;

  const amountSol =
    body.amountSolNotional ??
    (body.side === 'buy'
      ? lamportsToSol(BigInt(body.amountInRaw))
      : lamportsToSol(BigInt(body.amountOutRaw)));

  const submittedAt = new Date().toISOString();

  const feeBps = await getFeeBpsForUser(user.id);
  const lamports = solToLamports(amountSol);
  const platformFeeLamports = Number((lamports * BigInt(feeBps)) / 10_000n);

  const trade = await insertTrade({
    id: randomUUID(),
    user_id: user.id,
    mint: mintCanon,
    side: body.side,
    amount_in_raw: body.amountInRaw,
    amount_out_raw: body.amountOutRaw,
    amount_sol: amountSol,
    platform_fee_lamports: Number.isFinite(platformFeeLamports) ? platformFeeLamports : null,
    tx_signature: txSignature,
    status: 'confirmed',
    submitted_at: submittedAt,
    confirmed_at: new Date().toISOString(),
  });

  try {
    await recordReferralEarningFromTrade({
      referredUserId: user.id,
      tradeId: trade.id,
      platformFeeLamports,
    });
  } catch {
    /* best-effort */
  }

  try {
    await awardPoints(user.id, 'trade_volume', {
      dedupeKey: `trade:${txSignature}`,
      amountSol,
      metadata: { mint: mintCanon, side: body.side, signature: txSignature },
    });
  } catch {
    /* best-effort */
  }

  try {
    const n = await countConfirmedTradesForUser(user.id);
    if (n === 1) {
      await awardPoints(user.id, 'first_trade', {
        dedupeKey: 'first_trade',
        metadata: { signature: txSignature },
      });
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    signature: txSignature,
    tradeId: trade.id,
    status: 'confirmed',
  });
}
