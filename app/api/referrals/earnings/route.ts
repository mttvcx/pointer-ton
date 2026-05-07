import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { listReferralEarningsForUser, sumReferralEarningsLamports } from '@/lib/referrals/earnings';
import { lamportsToSol } from '@/lib/utils/formatters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  try {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 50),
    );
    const [rows, sums] = await Promise.all([
      listReferralEarningsForUser(r.user.id, { limit }),
      sumReferralEarningsLamports(r.user.id),
    ]);

    return NextResponse.json({
      sums: {
        ...sums,
        paidSol: lamportsToSol(BigInt(Math.round(sums.paid))),
        pendingSol: lamportsToSol(BigInt(Math.round(sums.pending))),
        totalSol: lamportsToSol(BigInt(Math.round(sums.total))),
      },
      recent: rows.map((e) => ({
        id: e.id,
        referredId: e.referred_id,
        tradeId: e.trade_id,
        amountLamports: Number(e.amount_lamports),
        amountSol: lamportsToSol(BigInt(Math.round(Number(e.amount_lamports)))),
        paidOut: e.paid_out,
        paidOutTxSignature: e.paid_out_tx_signature,
        paidOutAt: e.paid_out_at,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
