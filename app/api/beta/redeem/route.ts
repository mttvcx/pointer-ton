import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { hashBetaCode, normalizeBetaCodeInput } from '@/lib/beta/codeHash';
import {
  BETA_COOKIE_NAME,
  signBetaSessionCookie,
} from '@/lib/beta/session-cookie';
import { tryConsumeBetaCode } from '@/lib/db/betaCodes';
import { getUserByPrivyId, updateUser } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  code: z.string().min(6).max(48),
});

function betaCookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  const secret = process.env.BETA_SESSION_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }
  const pepper = process.env.BETA_CODE_PEPPER?.trim();
  if (!pepper) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const normalized = normalizeBetaCodeInput(body.code);
  const hash = hashBetaCode(normalized, pepper);

  if (user.beta_granted_at) {
    const cookie = await signBetaSessionCookie(user.id, secret);
    const res = NextResponse.json({ ok: true, alreadyGranted: true });
    res.cookies.set(BETA_COOKIE_NAME, cookie, betaCookieOpts(60 * 60 * 24 * 400));
    return res;
  }

  const consumed = await tryConsumeBetaCode(hash, user.id);
  if (!consumed) {
    return NextResponse.json({ error: 'invalid_code', message: 'Invalid or already used code' }, { status: 400 });
  }

  await updateUser(user.id, { beta_granted_at: new Date().toISOString() });
  const cookie = await signBetaSessionCookie(user.id, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BETA_COOKIE_NAME, cookie, betaCookieOpts(60 * 60 * 24 * 400));
  return res;
}
