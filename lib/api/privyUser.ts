import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
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
    const v = await verifyPrivyAccessToken(accessToken);
    verified = { authSubject: v.privyId, walletAddress: v.walletAddress };
  } catch {
    return { error: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  const user = await getUserByPrivyId(verified.authSubject);
  if (!user) {
    return {
      error: NextResponse.json(
        {
          error: 'user_not_synced',
          message: 'Complete sign-in from the app menu (Privy session missing user row)',
        },
        { status: 403 },
      ),
    };
  }
  return { user };
}
