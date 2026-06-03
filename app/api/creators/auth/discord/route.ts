import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { discordAuthorizeUrl } from '@/lib/creators/discord';
import { portalAbsoluteUrl } from '@/lib/creators/portalUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'pointer_creator_oauth_state';

export async function GET() {
  try {
    const state = randomBytes(16).toString('hex');
    const jar = await cookies();
    jar.set({
      name: STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return NextResponse.redirect(discordAuthorizeUrl(state));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_config_error';
    return NextResponse.redirect(portalAbsoluteUrl(`/portal?error=${encodeURIComponent(message)}`));
  }
}
