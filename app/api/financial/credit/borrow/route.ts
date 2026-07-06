import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { buildBorrowTx } from '@/lib/financial/kaminoClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prepare a Credit-mode borrow: build an UNSIGNED Kamino deposit+borrow tx for the
 * client to sign via Privy (non-custodial). `simulated:true` = Kamino isn't wired
 * yet → the app reflects the borrow in its local model (no real funds move).
 * Server enforces the LTV guardrail inside buildBorrowTx.
 */
const Body = z.object({
  amountUsd: z.number().positive().max(1_000_000),
  collateralMint: z.string().min(32).max(64),
  collateralUsd: z.number().min(0).max(1e12),
  borrowedUsd: z.number().min(0).max(1e12).default(0),
});

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const wallet = auth.user.wallet_address;
  if (!wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const built = await buildBorrowTx({
      wallet,
      collateralMint: parsed.collateralMint,
      amountUsd: parsed.amountUsd,
      collateralUsd: parsed.collateralUsd,
      borrowedUsd: parsed.borrowedUsd,
    });
    if (!built) return NextResponse.json({ simulated: true });
    return NextResponse.json({ simulated: false, txBase64: built.txBase64 });
  } catch (err) {
    const over = err instanceof Error && err.message === 'KAMINO_BORROW_OVER_LIMIT';
    return NextResponse.json({ error: over ? 'over_limit' : 'borrow_failed' }, { status: over ? 400 : 502 });
  }
}
