import { NextResponse, type NextRequest } from 'next/server';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { getPackPaymentByTx } from '@/lib/db/packs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Poll the delivery outcome of a live pack open. The pack-open response returns
 * immediately and fulfillment (treasury buy + transfer) finishes a few seconds
 * later in an `after()` task; the client polls this until the payment row leaves
 * the `verified` state.
 *
 *   verified           → still delivering (keep polling)
 *   fulfilled          → tokens delivered to the wallet
 *   failed | refunded  → delivery failed (eligible for refund)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let userId: string | null = null;
  try {
    const verified = await verifyPrivyAccessToken(accessToken);
    const user = await getUserByPrivyId(verified.privyId);
    userId = user?.id ?? null;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  const tx = req.nextUrl.searchParams.get('tx');
  if (!tx || tx.length < 64 || tx.length > 128) {
    return NextResponse.json({ error: 'invalid_tx' }, { status: 400 });
  }

  let row: Awaited<ReturnType<typeof getPackPaymentByTx>>;
  try {
    row = await getPackPaymentByTx(tx);
  } catch {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Only the buyer may read their own payment status.
  if (row.user_id && row.user_id !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const status = row.status;
  const pending = status === 'verified';
  const delivered = status === 'fulfilled';
  const failed = status === 'failed' || status === 'refunded';

  return NextResponse.json({ status, pending, delivered, failed, openId: row.open_id ?? null });
}
