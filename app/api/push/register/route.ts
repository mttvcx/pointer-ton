import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { upsertDevicePushToken } from '@/lib/db/devicePushTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/register { expoPushToken, platform?:'ios'|'android' }
 * Registers a mobile (Expo) push token. Web push stays on /api/push/subscribe.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: { expoPushToken?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const token = (body.expoPushToken ?? '').trim();
  // Expo tokens look like ExponentPushToken[…] or ExpoPushToken[…].
  if (!token || !/^Expo(nent)?PushToken\[/.test(token)) {
    return NextResponse.json({ error: 'invalid_expo_token' }, { status: 400 });
  }
  const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;

  try {
    await upsertDevicePushToken(auth.user.id, token, platform);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'missing_device_push_tokens_table') {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'register_failed';
    return NextResponse.json({ error: 'register_failed', message }, { status: 500 });
  }
}
