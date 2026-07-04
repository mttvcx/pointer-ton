import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { z } from 'zod';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { requirePointerUser } from '@/lib/api/privyUser';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { assertWriteAllowed, emergencyBlockedResponse, EmergencyBlockedError } from '@/lib/emergency/controls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;

const bodySchema = z.object({
  from: z.string().min(32).max(64),
  to: z.string().min(32).max(64),
  amountUsdc: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 1_000_000, 'amount_out_of_range'),
});

/**
 * Build an UNSIGNED USDC (SPL) transfer for the sender's wallet to sign via Privy
 * signAndSend — the P2P send path. Server never holds keys. Idempotently creates
 * the recipient ATA (payer = sender) then transfers. Freeze- + emergency-gated
 * like every fund-out path.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const frozen = await accountFreezeGateOrNull(auth.user.id, 'trading');
  if (frozen) return frozen;
  try {
    await assertWriteAllowed();
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const { from, to, amountUsdc } = parsed.data;

  try {
    const fromPk = new PublicKey(from);
    const toPk = new PublicKey(to);
    if (fromPk.equals(toPk)) return NextResponse.json({ error: 'same_wallet' }, { status: 400 });

    const rawAmount = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
    const fromAta = getAssociatedTokenAddressSync(USDC_MINT, fromPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const toAta = getAssociatedTokenAddressSync(USDC_MINT, toPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await heliusCall(
      'getLatestBlockhash',
      HELIUS_CREDITS.RPC,
      () => conn.getLatestBlockhash('confirmed'),
    );

    const tx = new Transaction({ feePayer: fromPk, blockhash, lastValidBlockHeight })
      // Idempotent — no-op if the recipient already has a USDC account; sender pays rent if not.
      .add(
        createAssociatedTokenAccountIdempotentInstruction(
          fromPk,
          toAta,
          toPk,
          USDC_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      )
      .add(
        createTransferCheckedInstruction(
          fromAta,
          USDC_MINT,
          toAta,
          fromPk,
          rawAmount,
          USDC_DECIMALS,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return NextResponse.json({
      transaction: Buffer.from(serialized).toString('base64'),
      amountRaw: rawAmount.toString(),
      recipientAta: toAta.toBase58(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'build_failed' }, { status: 400 });
  }
}
