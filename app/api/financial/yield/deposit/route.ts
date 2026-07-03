import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { lulo, USDC_SOLANA_MINT } from '@/lib/financial/luloClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    owner: z.string().min(32),
    amountUsd: z.number().positive().max(1_000_000),
  })
  .strict();

/**
 * "Put to work" — generate the UNSIGNED Lulo deposit transaction that moves the
 * user's USDC into Smart Yield. The app signs it with the Privy Solana wallet and
 * broadcasts it through the same proven path trades use (auth.signAndSend →
 * /api/solana/rpc). This route never signs or moves funds itself; it only builds
 * the transaction. `configured: false` when there's no LULO_API_KEY.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!lulo.configured()) {
    return NextResponse.json({ configured: false, transaction: null });
  }

  let owner: string;
  try {
    owner = new PublicKey(body.owner.trim()).toBase58();
  } catch {
    return NextResponse.json({ error: 'invalid_owner' }, { status: 400 });
  }

  try {
    const { transaction } = await lulo.generateDeposit({
      owner,
      mintAddress: USDC_SOLANA_MINT,
      depositAmount: String(body.amountUsd),
    });
    if (!transaction) {
      return NextResponse.json({ configured: true, transaction: null, error: 'no_transaction' }, { status: 502 });
    }
    return NextResponse.json({ configured: true, transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'deposit_failed';
    return NextResponse.json({ configured: true, transaction: null, error: message }, { status: 502 });
  }
}
