import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse } from '@/lib/ai/http';
import { parseTrackerRuleNaturalLanguage } from '@/lib/ai/pipelines/parseTrackerRule';
import { getTrackedWalletById } from '@/lib/db/wallets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    trackedWalletId: z.string().uuid(),
    nlText: z.string().trim().min(4).max(800),
  })
  .strict();

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

  const tracked = await getTrackedWalletById(auth.user.id, body.trackedWalletId);
  if (!tracked) {
    return NextResponse.json({ error: 'not_found', message: 'Tracker not found' }, { status: 404 });
  }

  try {
    const parsed = await parseTrackerRuleNaturalLanguage({
      userId: auth.user.id,
      nlText: body.nlText,
      walletAddress: tracked.wallet_address,
      walletLabel: tracked.label,
    });
    return NextResponse.json({
      summary: parsed.summary,
      condition: parsed.condition,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
