import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPointerAccessToken } from '@/lib/auth/pointerSession';
import type { Tables } from '@/lib/supabase/types';

export type AuthSuccess = { user: Tables<'users'> };

export async function requirePointerUser(req: NextRequest): Promise<
  AuthSuccess | { error: NextResponse }
> {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return { error: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }) };
  }
  let verified: { authSubject: string; walletAddress: string };
  try {
    verified = await verifyPointerAccessToken(accessToken);
  } catch {
    return { error: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  const user = await getUserByPrivyId(verified.authSubject);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'user_not_synced', message: 'Connect with TonConnect again (session missing user)' },
        { status: 403 },
      ),
    };
  }
  return { user };
}
