import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { currentMonthKey } from '@/lib/creators/config';
import { getLeaderboard, getOrCreatePrizePool } from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const monthKey = req.nextUrl.searchParams.get('month') ?? currentMonthKey();
  const verifiedOnly = req.nextUrl.searchParams.get('verified') !== '0';

  const [pool, rankings] = await Promise.all([
    getOrCreatePrizePool(monthKey),
    getLeaderboard(monthKey, verifiedOnly),
  ]);

  return NextResponse.json({
    monthKey,
    prizePoolUsd: Number(pool.total_usd_cents) / 100,
    payoutBreakdown: pool.payout_breakdown,
    verifiedOnly,
    rankings: rankings.slice(0, 50),
  });
}
