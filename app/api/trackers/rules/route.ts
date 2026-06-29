import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse } from '@/lib/ai/http';
import { parseTrackerRuleNaturalLanguage } from '@/lib/ai/pipelines/parseTrackerRule';
import {
  insertTrackerRule,
  listTrackerRulesForWallet,
} from '@/lib/db/trackerRules';
import { getTrackedWalletById } from '@/lib/db/wallets';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { TrackerRuleConditionSchema } from '@/lib/trackers/ruleCondition';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PostBody = z
  .object({
    trackedWalletId: z.string().uuid(),
    nlText: z.string().trim().min(4).max(800),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  const trackerId = req.nextUrl.searchParams.get('trackedWalletId')?.trim();
  if (!trackerId) {
    return NextResponse.json({ error: 'missing_trackedWalletId' }, { status: 400 });
  }

  try {
    const tracked = await getTrackedWalletById(auth.user.id, trackerId);
    if (!tracked) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const rules = await listTrackerRulesForWallet(auth.user.id, trackerId);
    return NextResponse.json({
      rules: rules.map((r) => ({
        id: r.id,
        trackedWalletId: r.tracked_wallet_id,
        nlText: r.nl_text,
        condition: r.condition,
        summary: r.summary,
        enabled: r.enabled,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  // Per-user account freeze (automation kind, fail-closed) — a frozen account
  // cannot add a new automation rule to a tracker.
  const frozen = await accountFreezeGateOrNull(auth.user.id, 'automation');
  if (frozen) return frozen;

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
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
    TrackerRuleConditionSchema.parse(parsed.condition);

    const row = await insertTrackerRule({
      user_id: auth.user.id,
      tracked_wallet_id: body.trackedWalletId,
      nl_text: body.nlText.trim(),
      condition: parsed.condition as Json,
      summary: parsed.summary,
      enabled: true,
    });

    return NextResponse.json({
      rule: {
        id: row.id,
        trackedWalletId: row.tracked_wallet_id,
        nlText: row.nl_text,
        condition: row.condition,
        summary: row.summary,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
