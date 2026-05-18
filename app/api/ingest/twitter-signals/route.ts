import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import {
  emitTwitterListenAlerts,
  type TwitterListenIngestTweet,
} from '@/lib/alerts/emitTwitterListenAlerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TweetSchema = z
  .object({
    id: z.string().min(6).max(64),
    handle: z.string().min(1).max(64),
    text: z.string().max(12_000).default(''),
    urls: z.array(z.string().url()).max(48).optional(),
    imageUrls: z.array(z.string().url()).max(12).optional(),
    tweetUrl: z.string().url().optional(),
    createdAt: z.string().max(48).optional(),
  })
  .strict();

const BodySchema = z
  .object({
    tweets: z.array(TweetSchema).min(1).max(250),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const tweets: TwitterListenIngestTweet[] = parsed.data.tweets.map((t) => ({
    id: t.id.trim(),
    handle: t.handle.trim(),
    text: t.text,
    urls: t.urls,
    imageUrls: t.imageUrls,
    tweetUrl: t.tweetUrl,
    createdAt: t.createdAt,
  }));

  const inserted = await emitTwitterListenAlerts(tweets);
  return NextResponse.json({ ok: true, processed: tweets.length, alertsInserted: inserted });
}
