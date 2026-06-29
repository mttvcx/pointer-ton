import { type NextRequest, NextResponse } from 'next/server';
import { requireAnyAdmin } from '@/lib/api/adminAuth';
import { sendOpsAlertNow } from '@/lib/ops/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fire a synthetic ops alert to every configured channel (Discord/Slack),
 *  bypassing the cooldown, so an admin can verify their webhook wiring. Returns
 *  the channels attempted; `[]` means nothing is configured. */
export async function POST(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;

  const { channels } = await sendOpsAlertNow({
    category: 'system',
    name: 'test-alert',
    status: 'error',
    severity: 'critical',
    message: `Test alert from ${auth.ctx.username || auth.ctx.userId} — wiring OK.`,
    detail: { triggeredBy: auth.ctx.username || auth.ctx.userId, kind: 'manual_test' },
  });

  return NextResponse.json({
    ok: true,
    channels,
    configured: channels.length > 0,
    note: channels.length === 0 ? 'Set OPS_DISCORD_WEBHOOK_URL and/or OPS_SLACK_WEBHOOK_URL.' : undefined,
  });
}
