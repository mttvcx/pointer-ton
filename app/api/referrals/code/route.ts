import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { claimVanityReferralCode, ensureDefaultReferralCode } from '@/lib/referrals/codes';
import { referralFeeShareBps } from '@/lib/referrals/constants';
import { countReferralsForReferrer, sumReferralEarningsLamports } from '@/lib/referrals/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PostSchema = z
  .object({
    code: z.string().min(4).max(12),
  })
  .strict();

export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;
  try {
    const codeRow = await ensureDefaultReferralCode(r.user.id);
    const [referredCount, earnings] = await Promise.all([
      countReferralsForReferrer(r.user.id),
      sumReferralEarningsLamports(r.user.id),
    ]);
    return NextResponse.json({
      code: codeRow.code,
      usesCount: codeRow.uses_count,
      isActive: codeRow.is_active,
      referredCount,
      earnings,
      feeShareBps: referralFeeShareBps(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;
  try {
    const json: unknown = await req.json();
    const body = PostSchema.parse(json);
    const updated = await claimVanityReferralCode(r.user.id, body.code);
    return NextResponse.json({
      code: updated.code,
      usesCount: updated.uses_count,
      isActive: updated.is_active,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    const status =
      message.includes('invalid_code') || message.includes('23505') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
