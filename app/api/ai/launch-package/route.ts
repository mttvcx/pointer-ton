import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse, badBodyResponse } from '@/lib/ai/http';
import { generateLaunchPackage } from '@/lib/launch/generateLaunchPackage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    id: z.string().trim().max(64).optional(),
    text: z.string().trim().min(1).max(4000),
    authorHandle: z.string().trim().min(1).max(64),
    imageUrls: z.array(z.string().url().max(2048)).max(4).optional(),
    tweetUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return badBodyResponse(err);
  }

  try {
    const out = await generateLaunchPackage(
      {
        id: body.id,
        text: body.text,
        authorHandle: body.authorHandle,
        imageUrls: body.imageUrls,
        tweetUrl: body.tweetUrl,
      },
      auth.user.id,
    );
    return NextResponse.json({
      package: out.package,
      cacheHit: out.cacheHit,
      fromCache: out.fromCache,
      modelUsed: out.modelUsed,
      cacheSubject: out.cacheSubject,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
