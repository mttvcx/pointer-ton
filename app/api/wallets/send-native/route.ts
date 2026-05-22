import { NextResponse } from 'next/server';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { z } from 'zod';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  from: z.string().min(32),
  to: z.string().min(32),
  lamports: z.number().int().positive(),
});

/** Build an unsigned native SOL transfer for the client wallet to sign. */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ message: 'missing_authorization' }, { status: 401 });
  }

  try {
    await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ message: 'invalid_token' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
  }

  const { from, to, lamports } = parsed.data;

  try {
    const fromPk = new PublicKey(from);
    const toPk = new PublicKey(to);
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await heliusCall(
      'getLatestBlockhash',
      HELIUS_CREDITS.RPC,
      () => conn.getLatestBlockhash('confirmed'),
    );

    const tx = new Transaction({
      feePayer: fromPk,
      blockhash,
      lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: fromPk,
        toPubkey: toPk,
        lamports,
      }),
    );

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: Buffer.from(serialized).toString('base64'),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'build_failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}
