import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import { resumePackFulfillment } from '@/lib/packs/resumeFulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z
  .object({
    paymentTx: z.string().min(64).max(128),
    /** Admin reconcile only — bind a payment whose open_id was never set. */
    openId: z.string().min(8).max(64).optional(),
  })
  .strict();

/**
 * Finish delivering a paid pack open. Idempotent + resumable: the client polls
 * this while a multi-reward pack's delivery exceeds the open route's 60s budget,
 * and a reconcile script uses the admin path (CRON_SECRET) to mop up stragglers
 * (optionally binding an open_id that was never set when the function was killed).
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Admin/reconcile path: CRON_SECRET (Bearer or x-cron-secret). Can bind open_id
  // and bypass the per-user ownership check.
  if (authorizeCronRequest(req)) {
    const out = await resumePackFulfillment({
      paymentTx: body.paymentTx,
      bindOpenId: body.openId ?? null,
    });
    return NextResponse.json(out);
  }

  // User path: a Privy token resumes only the caller's own payment.
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

  const out = await resumePackFulfillment({ paymentTx: body.paymentTx, expectUserId: userId });
  return NextResponse.json(out);
}
