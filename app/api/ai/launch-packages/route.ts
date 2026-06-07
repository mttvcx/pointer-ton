import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse } from '@/lib/ai/http';
import { generateLaunchPackage } from '@/lib/launch/generateLaunchPackage';
import { EMPTY_LAUNCH_PACKAGE } from '@/lib/launch/mapLaunchPackageOutput';
import { tweetLaunchCacheSubject } from '@/lib/launch/tweetLaunchSubject';
import type { LaunchPackage, TweetLaunchInput } from '@/lib/launch/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TweetBody = z
  .object({
    id: z.string().trim().max(64).optional(),
    text: z.string().trim().min(1).max(4000),
    authorHandle: z.string().trim().min(1).max(64),
    imageUrls: z.array(z.string().url().max(2048)).max(4).optional(),
    tweetUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict();

const Body = z
  .object({
    tweets: z.array(TweetBody).min(1).max(8),
  })
  .strict();

export type LaunchPackagesBatchItem = {
  subject: string;
  package: LaunchPackage;
  cacheHit: boolean;
  fromCache: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const items: LaunchPackagesBatchItem[] = [];

    for (const t of body.tweets) {
      const tweet: TweetLaunchInput = {
        id: t.id,
        text: t.text,
        authorHandle: t.authorHandle,
        imageUrls: t.imageUrls,
        tweetUrl: t.tweetUrl,
      };
      const subject = tweetLaunchCacheSubject(tweet);
      try {
        const out = await generateLaunchPackage(tweet, auth.user.id);
        items.push({
          subject,
          package: out.package,
          cacheHit: out.cacheHit,
          fromCache: out.fromCache,
        });
      } catch (err) {
        // One tweet failing AI (model JSON/schema miss, rate limit, provider
        // hiccup) shouldn't 500 the whole feed — degrade that row to "no launch".
        console.warn(
          '[/api/ai/launch-packages] tweet failed:',
          err instanceof Error ? err.message : err,
        );
        items.push({
          subject,
          package: { ...EMPTY_LAUNCH_PACKAGE },
          cacheHit: false,
          fromCache: false,
        });
      }
    }

    return NextResponse.json({ items });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
