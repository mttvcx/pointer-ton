import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { insertAppeal } from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AppealBody = z.object({
  targetType: z.enum(['video', 'account', 'ban']),
  targetId: z.string().uuid().optional(),
  message: z.string().min(20).max(4000),
  evidenceUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const parsed = AppealBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const appeal = await insertAppeal({
    creatorId: auth.creator!.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId ?? null,
    message: parsed.data.message,
    evidenceUrl: parsed.data.evidenceUrl ?? null,
  });

  return NextResponse.json({ appealId: appeal.id, status: 'pending' });
}
