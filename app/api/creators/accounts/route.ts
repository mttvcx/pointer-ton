import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { CreatorPlatformSchema } from '@/lib/creators/config';
import { addCreatorSocialAccount, listCreatorAccounts } from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  platform: CreatorPlatformSchema,
  handle: z.string().min(1).max(64),
  profileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;
  const accounts = await listCreatorAccounts(auth.creator!.id);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await addCreatorSocialAccount({
      creatorId: auth.creator!.id,
      platform: parsed.data.platform,
      handle: parsed.data.handle,
      profileUrl: parsed.data.profileUrl ?? null,
    });
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
