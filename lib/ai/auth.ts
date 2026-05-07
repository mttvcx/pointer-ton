import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId, type UserRow } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export type RequireUserResult =
  | { ok: true; user: UserRow; accessToken: string }
  | { ok: false; response: NextResponse };

/**
 * Standard Privy bearer + user-sync gate for AI routes. Mirrors the inline
 * blocks in /api/trade/* but factored out so every pipeline route stays thin.
 */
export async function requireSyncedUser(req: NextRequest): Promise<RequireUserResult> {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }),
    };
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid_token' }, { status: 401 }),
    };
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user, accessToken };
}
