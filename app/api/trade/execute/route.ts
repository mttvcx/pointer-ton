import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getFeeBpsForUser } from '@/lib/db/tiers';
import { countConfirmedTradesForUser, insertTrade } from '@/lib/db/trades';
import { getUserByPrivyId } from '@/lib/db/users';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { awardPoints } from '@/lib/points/award';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { recordReferralEarningFromTrade } from '@/lib/referrals/earnings';
import { submitTransaction } from '@/lib/solana/submit';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { lamportsToSol, solToLamports } from '@/lib/utils/formatters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ExecuteBodySchema = z
  .object({
    signedTransaction: z.string().min(80),
    userPublicKey: z.string().refine(isValidPublicKey, 'invalid userPublicKey'),
    mint: z.string().refine(isValidPublicKey),
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

  const tradeOk = await userCanUseWalletForTrading(user, body.userPublicKey);
  if (!tradeOk) {
    return NextResponse.json(
      {
        error: 'wallet_not_allowed',
        message: 'This wallet cannot trade in Pointer (imported keys are view-only until Phase 5)',
      },
      { status: 403 },
    );
  }

  let serialized: Uint8Array;
  try {
    serialized = Uint8Array.from(Buffer.from(body.signedTransaction, 'base64'));
  } catch {
    return NextResponse.json({ error: 'invalid_transaction_encoding' }, { status: 400 });
  }

  const amountSol =
    body.amountSolNotional ??
    (body.side === 'buy'
      ? lamportsToSol(BigInt(body.amountInRaw))
      : lamportsToSol(BigInt(body.amountOutRaw)));

  const submittedAt = new Date().toISOString();
  const result = await submitTransaction(serialized);

  if (result.status === 'failed') {
    try {
      await insertTrade({
        id: randomUUID(),
        user_id: user.id,
        mint: body.mint,
        side: body.side,
        amount_in_raw: body.amountInRaw,
        amount_out_raw: body.amountOutRaw,
        tx_signature: `failed:${randomUUID()}`,
        status: 'failed',
        failure_reason: result.error ?? 'submit_failed',
        submitted_at: submittedAt,
        confirmed_at: null,
      });
    } catch {
      /* best-effort audit row */
    }
    return NextResponse.json(
      { error: 'execute_failed', message: result.error, signature: result.signature },
      { status: 502 },
    );
  }

  const feeBps = await getFeeBpsForUser(user.id);
  const lamports = solToLamports(amountSol);
  const platformFeeLamports = Number((lamports * BigInt(feeBps)) / 10_000n);

  const trade = await insertTrade({
    id: randomUUID(),
    user_id: user.id,
    mint: body.mint,
    side: body.side,
    amount_in_raw: body.amountInRaw,
    amount_out_raw: body.amountOutRaw,
    amount_sol: amountSol,
    platform_fee_lamports: Number.isFinite(platformFeeLamports) ? platformFeeLamports : null,
    tx_signature: result.signature,
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
      dedupeKey: `trade:${result.signature}`,
      amountSol,
      metadata: { mint: body.mint, side: body.side, signature: result.signature },
    });
  } catch {
    /* best-effort */
  }

  try {
    const n = await countConfirmedTradesForUser(user.id);
    if (n === 1) {
      await awardPoints(user.id, 'first_trade', {
        dedupeKey: 'first_trade',
        metadata: { signature: result.signature },
      });
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    signature: result.signature,
    tradeId: trade.id,
    status: 'confirmed',
  });
}
