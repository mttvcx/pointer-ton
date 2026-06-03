import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import {
  currentMonthKey,
  detectPlatformFromUrl,
  normalizePostUrl,
} from '@/lib/creators/config';
import {
  getSocialAccountById,
  listCreatorVideos,
  submitCreatorVideo,
} from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  accountId: z.string().uuid(),
  postUrl: z.string().url().max(512),
  viewCount: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;
  const month = req.nextUrl.searchParams.get('month') ?? undefined;
  const videos = await listCreatorVideos(auth.creator!.id, month);
  return NextResponse.json({ videos });
}

export async function POST(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const account = await getSocialAccountById(parsed.data.accountId);
  if (!account || account.creator_id !== auth.creator!.id) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  }
  if (account.verification_status !== 'verified') {
    return NextResponse.json(
      { error: 'account_not_verified', message: 'Verify audience demographics before submitting clips.' },
      { status: 403 },
    );
  }

  const platform = detectPlatformFromUrl(parsed.data.postUrl);
  if (!platform || platform !== account.platform) {
    return NextResponse.json(
      { error: 'platform_mismatch', message: `URL must be a ${account.platform} link.` },
      { status: 400 },
    );
  }

  try {
    const video = await submitCreatorVideo({
      creatorId: auth.creator!.id,
      accountId: account.id,
      platform,
      postUrl: parsed.data.postUrl,
      postUrlNormalized: normalizePostUrl(parsed.data.postUrl),
      monthKey: currentMonthKey(),
      viewCount: parsed.data.viewCount,
    });
    return NextResponse.json({ video });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    if (message === 'duplicate_url') {
      return NextResponse.json(
        {
          error: 'duplicate_url',
          message: 'This clip URL was already submitted — reposting stolen content is not allowed.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
