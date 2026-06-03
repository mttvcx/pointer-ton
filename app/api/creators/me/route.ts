import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import {
  currentMonthKey,
  monthSubmissionDeadline,
  CREATOR_TIER_OFFERS,
} from '@/lib/creators/config';
import {
  getCreatorDashboardStats,
  listCreatorAccounts,
  listCreatorVideos,
} from '@/lib/db/creators';
import { isCreatorAdmin } from '@/lib/creators/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const monthKey = req.nextUrl.searchParams.get('month') ?? currentMonthKey();
  const [stats, accounts, videos] = await Promise.all([
    getCreatorDashboardStats(auth.creator!.id, monthKey),
    listCreatorAccounts(auth.creator!.id),
    listCreatorVideos(auth.creator!.id, monthKey),
  ]);

  const deadline = monthSubmissionDeadline();
  const now = Date.now();
  const msLeft = Math.max(0, deadline.getTime() - now);

  return NextResponse.json({
    creator: {
      id: auth.creator!.id,
      discordUsername: auth.creator!.discord_username,
      discordGlobalName: auth.creator!.discord_global_name,
      avatar: auth.creator!.discord_avatar,
      payoutMethod: auth.creator!.payout_method,
      payoutAddress: auth.creator!.payout_address,
      isAdmin: isCreatorAdmin(auth.session.discordId),
    },
    monthKey,
    countdownMs: msLeft,
    stats,
    accounts,
    recentVideos: videos.slice(0, 10),
    offers: CREATOR_TIER_OFFERS,
  });
}

const PayoutBody = z.object({
  method: z.enum(['crypto', 'paypal']),
  address: z.string().min(4).max(256),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const parsed = PayoutBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { updateCreatorPayout } = await import('@/lib/db/creators');
  await updateCreatorPayout(auth.creator!.id, parsed.data);
  return NextResponse.json({ ok: true });
}
