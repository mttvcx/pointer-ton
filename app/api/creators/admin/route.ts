import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { CreatorTierSchema } from '@/lib/creators/config';
import { isCreatorAdmin } from '@/lib/creators/session';
import {
  blacklistCreator,
  listPendingAppeals,
  listPendingVerifications,
  listPendingVideos,
  reviewAppeal,
  reviewVerification,
  reviewVideo,
} from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireAdmin(session: { discordId: string }) {
  if (!isCreatorAdmin(session.discordId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;
  const denied = requireAdmin(auth.session);
  if (denied) return denied;

  const [verifications, videos, appeals] = await Promise.all([
    listPendingVerifications(),
    listPendingVideos(),
    listPendingAppeals(),
  ]);

  return NextResponse.json({ verifications, videos, appeals });
}

const VerifyReviewBody = z.object({
  submissionId: z.string().uuid(),
  approved: z.boolean(),
  tier: CreatorTierSchema.optional(),
  tier1Pct: z.number().min(0).max(100).optional(),
  note: z.string().max(2000).optional(),
});

const VideoReviewBody = z.object({
  videoId: z.string().uuid(),
  status: z.enum([
    'approved',
    'rejected',
    'rejected_stolen',
    'rejected_botting',
    'rejected_audience',
    'reduced_pay',
  ]),
  viewCount: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
});

const AppealReviewBody = z.object({
  appealId: z.string().uuid(),
  approved: z.boolean(),
  note: z.string().max(2000).optional(),
});

const BlacklistBody = z.object({
  discordId: z.string().min(1),
  reason: z.string().min(4).max(2000),
});

export async function POST(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;
  const denied = requireAdmin(auth.session);
  if (denied) return denied;

  const body: unknown = await req.json();
  const action = (body as { action?: string }).action;

  if (action === 'review_verification') {
    const parsed = VerifyReviewBody.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    if (parsed.data.approved && !parsed.data.tier) {
      return NextResponse.json({ error: 'tier_required' }, { status: 400 });
    }
    if (parsed.data.approved && parsed.data.tier === 'basic' && (parsed.data.tier1Pct ?? 0) < 20) {
      return NextResponse.json(
        { error: 'tier1_too_low', message: 'BASIC requires at least 20% Tier-1 audience.' },
        { status: 400 },
      );
    }
    if (parsed.data.approved && parsed.data.tier === 'elite' && (parsed.data.tier1Pct ?? 0) < 40) {
      return NextResponse.json(
        { error: 'usa_too_low', message: 'ELITE requires at least 40% USA audience.' },
        { status: 400 },
      );
    }
    await reviewVerification({
      submissionId: parsed.data.submissionId,
      approved: parsed.data.approved,
      tier: parsed.data.tier,
      tier1Pct: parsed.data.tier1Pct,
      note: parsed.data.note,
      adminDiscordId: auth.session.discordId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'review_video') {
    const parsed = VideoReviewBody.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    await reviewVideo({
      videoId: parsed.data.videoId,
      status: parsed.data.status,
      viewCount: parsed.data.viewCount,
      note: parsed.data.note,
      adminDiscordId: auth.session.discordId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'review_appeal') {
    const parsed = AppealReviewBody.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    await reviewAppeal({
      appealId: parsed.data.appealId,
      approved: parsed.data.approved,
      note: parsed.data.note,
      adminDiscordId: auth.session.discordId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'blacklist') {
    const parsed = BlacklistBody.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    await blacklistCreator({
      discordId: parsed.data.discordId,
      reason: parsed.data.reason,
      adminDiscordId: auth.session.discordId,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
