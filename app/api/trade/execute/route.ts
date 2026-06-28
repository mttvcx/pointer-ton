import { createHash, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getFeeBpsForUser } from '@/lib/db/tiers';
import { countConfirmedTradesForUser, getTradeBySignature, insertTrade } from '@/lib/db/trades';
import { getUserByPrivyId } from '@/lib/db/users';
import { tradingFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { awardPoints } from '@/lib/points/award';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { recordReferralEarningFromTrade } from '@/lib/referrals/earnings';
import { recordTradeCashbackAccrual } from '@/lib/cashback/accrual';
import { isSellPackOrigin, consumePackInventory } from '@/lib/db/packInventory';
import { PACK_ITEM_SELL_FEE_BPS } from '@/lib/packs/constants';
import { lamportsToSol, solToLamports } from '@/lib/utils/formatters';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { ingestExecutedSolSwap } from '@/lib/trade/ingestExecutedSwap';
import { broadcastSignedTransaction } from '@/lib/solana/broadcast';
import { enforceTradeRateLimit } from '@/lib/rate-limit/userAction';
import { waitForSolConfirmation } from '@/lib/solana/confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Embedded-wallet SOL trades broadcast their signed tx through this route; keep
// the function alive long enough for the Helius send to settle.
export const maxDuration = 30;

const SolExecuteSchema = z
  .object({
    chain: z.literal('sol'),
    /** Already-broadcast signature (external wallets self-broadcast via their RPC). */
    txSignature: z.string().min(64).max(128).optional(),
    /**
     * Base64 fully-signed VersionedTransaction from an embedded Pointer wallet
     * (sign-only). The server broadcasts it through the private Helius RPC — the
     * public client RPC rejects sends with Solana #8100002.
     */
    signedTransaction: z.string().min(80).optional(),
    userPublicKey: z.string().min(32),
    mint: z.string().min(32),
    side: z.enum(['buy', 'sell']),
    amountInRaw: z.string().regex(/^\d+$/),
    amountOutRaw: z.string().regex(/^\d+$/),
    amountSolNotional: z.number().nonnegative().optional(),
  })
  .strict()
  .refine((d) => Boolean(d.txSignature) || Boolean(d.signedTransaction), {
    message: 'txSignature_or_signedTransaction_required',
  });

const TonExecuteSchema = z
  .object({
    /** TonConnect `sendTransaction` result: signed external-message BOC (base64). */
    signedTransaction: z.string().min(80),
    userPublicKey: z.string().min(1),
    mint: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    amountInRaw: z.string().regex(/^\d+$/),
    amountOutRaw: z.string().regex(/^\d+$/),
    amountSolNotional: z.number().nonnegative().optional(),
    chain: z.literal('ton').optional(),
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

  // Defense-in-depth — same per-user fail-closed gate as quote.
  const freezeBlocked = await tradingFreezeGateOrNull(user.id);
  if (freezeBlocked) return freezeBlocked;

  // Generous per-user cap so a script can't hammer the trade money path
  // (fail-open; tune via TRADE_RATE_LIMIT_PER_MIN, disable via env).
  const tradeRl = await enforceTradeRateLimit(user.id);
  if (tradeRl) return tradeRl;

  const json: unknown = await req.json();
  const parsedSol = SolExecuteSchema.safeParse(json);
  if (parsedSol.success) {
    const body = parsedSol.data;
    if (inferMintKind(body.mint) !== 'sol' || inferMintKind(body.userPublicKey) !== 'sol') {
      return NextResponse.json({ error: 'invalid_sol_payload' }, { status: 400 });
    }
    let walletCanon: string;
    let mintCanon: string;
    try {
      walletCanon = new PublicKey(body.userPublicKey.trim()).toBase58();
      mintCanon = new PublicKey(body.mint.trim()).toBase58();
    } catch {
      return NextResponse.json({ error: 'invalid_sol_address' }, { status: 400 });
    }

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

    // Resolve the on-chain signature. External wallets self-broadcast and pass
    // the signature; embedded Pointer wallets sign-only and pass a signed tx we
    // broadcast through the private Helius RPC (the public client RPC rejects
    // sends with #8100002, which silently killed embedded-wallet trades).
    let txSignature: string;
    if (body.signedTransaction) {
      try {
        txSignature = await broadcastSignedTransaction(
          Buffer.from(body.signedTransaction, 'base64'),
        );
      } catch (err) {
        console.error('[trade/execute] sol broadcast failed', err);
        return NextResponse.json(
          {
            error: 'broadcast_failed',
            message: err instanceof Error ? err.message : 'send_failed',
          },
          { status: 502 },
        );
      }
    } else {
      txSignature = body.txSignature!;
    }

    const amountSol =
      body.amountSolNotional ??
      (body.side === 'buy'
        ? lamportsToSol(BigInt(body.amountInRaw))
        : lamportsToSol(BigInt(body.amountOutRaw)));

    const submittedAt = new Date().toISOString();
    // Pack-item sells pay the elevated pack fee (2%) and earn no cashback.
    // Re-checked server-side (never trusting the client) so the recorded fee
    // matches the on-chain swap the quote built.
    const packItemSell =
      body.side === 'sell' ? await isSellPackOrigin(user.id, mintCanon) : false;
    const cashbackEligible = !packItemSell;
    const feeBps = packItemSell ? PACK_ITEM_SELL_FEE_BPS : await getFeeBpsForUser(user.id);
    const lamports = solToLamports(amountSol);
    const platformFeeLamports = Number((lamports * BigInt(feeBps)) / 10_000n);

    // Idempotency: a retried submit of the same signature must not insert a
    // second trade row (which would double-accrue cashback/referral — those are
    // keyed on tradeId). Return the already-recorded trade instead.
    const existingTrade = await getTradeBySignature(txSignature);
    if (existingTrade) {
      return NextResponse.json({
        signature: txSignature,
        tradeId: existingTrade.id,
        status: existingTrade.status,
        packItemSell,
        feeBps,
        idempotent: true,
      });
    }

    // Confirm-before-accrue: only treat the trade as real once it lands on chain.
    // A reverted/failed swap (slippage etc.) returns 502 instead of recording a
    // "confirmed" trade that pays cashback. Kill-switch: POINTER_DISABLE_TRADE_CONFIRM=1.
    let solConfirmed = true;
    if (process.env.POINTER_DISABLE_TRADE_CONFIRM !== '1') {
      const state = await waitForSolConfirmation(txSignature, 12_000);
      if (state === 'failed') {
        return NextResponse.json(
          { error: 'tx_failed', signature: txSignature, message: 'Transaction failed on-chain' },
          { status: 502 },
        );
      }
      solConfirmed = state === 'confirmed';
    }

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

    // Slow/unconfirmed send: record the trade + return success (unchanged
    // contract) but skip ALL reward accrual + side effects until it's confirmed.
    if (!solConfirmed) {
      return NextResponse.json({
        signature: txSignature,
        tradeId: trade.id,
        status: 'confirmed',
        packItemSell,
        feeBps,
      });
    }

    try {
      await recordReferralEarningFromTrade({
        referredUserId: user.id,
        tradeId: trade.id,
        platformFeeLamports,
      });
    } catch {
      /* best-effort */
    }

    // Trader cashback rebate (50% of the platform fee they paid). Skipped for
    // pack-item sells, which are charged a higher fee and earn no cashback.
    if (cashbackEligible) {
      try {
        await recordTradeCashbackAccrual({
          userId: user.id,
          tradeId: trade.id,
          platformFeeLamports,
          signature: txSignature,
        });
      } catch {
        /* best-effort */
      }
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

    // Best-effort desk sync so trades tape / holders update without waiting on webhook.
    try {
      await ingestExecutedSolSwap({ mint: mintCanon, txSignature });
    } catch {
      /* client refetch still runs */
    }

    // Draw down pack inventory for the sold token (FIFO) so future sells of the
    // same mint revert to the normal fee once pack-acquired units are exhausted.
    if (packItemSell) {
      try {
        await consumePackInventory(user.id, mintCanon, body.amountInRaw);
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({
      signature: txSignature,
      tradeId: trade.id,
      status: 'confirmed',
      packItemSell,
      feeBps,
    });
  }

  let body: z.infer<typeof TonExecuteSchema>;
  try {
    body = TonExecuteSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  if (!normalizeTonAddress(body.userPublicKey) || !normalizeTonAddress(body.mint)) {
    return NextResponse.json({ error: 'invalid_ton_address' }, { status: 400 });
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

  // Idempotency: a retried submit of the same signed BOC hashes to the same
  // tx_signature; return the recorded trade instead of double-inserting.
  const existingTrade = await getTradeBySignature(txSignature);
  if (existingTrade) {
    return NextResponse.json({
      signature: txSignature,
      tradeId: existingTrade.id,
      status: existingTrade.status,
      idempotent: true,
    });
  }

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

  // Trader cashback rebate (TON has no packs, so every trade is eligible).
  try {
    await recordTradeCashbackAccrual({
      userId: user.id,
      tradeId: trade.id,
      platformFeeLamports,
      signature: txSignature,
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
