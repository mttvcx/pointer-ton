import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { freezeAccount, getActiveControl, releaseAccount } from '@/lib/db/accountControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-account automation kill switch (self-service, for web + mobile). Reuses the
 * `account_controls` table + freeze gate. Halting is scope='automation' so it pauses
 * all automation firing (incl. delegated auto-exec via isHalted) WITHOUT touching
 * manual trading. A user can only lift a freeze THEY created — an admin freeze
 * (scope all/trading, created_by admin) is not self-releasable here.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    const control = await getActiveControl(auth.user.id);
    const frozen = Boolean(control && (control.scope === 'automation' || control.scope === 'all'));
    const byAdmin = Boolean(control && control.created_by && control.created_by !== auth.user.id);
    return NextResponse.json({
      automationPaused: frozen,
      byAdmin,
      scope: control?.scope ?? null,
      reason: control?.reason ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'read_failed' }, { status: 500 });
  }
}

const PatchBody = z.object({ paused: z.boolean() });

export async function PATCH(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
    if (parsed.data.paused) {
      await freezeAccount({
        targetUserId: auth.user.id,
        scope: 'automation',
        reason: 'user_kill_switch',
        createdByUserId: auth.user.id,
      });
      return NextResponse.json({ automationPaused: true });
    }

    // Resume — but never let a user lift an admin freeze.
    const control = await getActiveControl(auth.user.id);
    if (control && control.created_by && control.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'admin_freeze', automationPaused: true }, { status: 403 });
    }
    await releaseAccount({ targetUserId: auth.user.id, reason: 'user_resumed', releasedByUserId: auth.user.id });
    return NextResponse.json({ automationPaused: false });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'update_failed' }, { status: 500 });
  }
}
