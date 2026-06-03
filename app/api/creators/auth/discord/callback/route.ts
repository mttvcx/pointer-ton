import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  discordAvatarUrl,
  exchangeDiscordCode,
  fetchDiscordUser,
} from '@/lib/creators/discord';
import { upsertCreatorFromDiscord } from '@/lib/db/creators';
import {
  creatorSessionCookieOptions,
  signCreatorSession,
} from '@/lib/creators/session';
import { portalAbsoluteUrl } from '@/lib/creators/portalUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'pointer_creator_oauth_state';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(portalAbsoluteUrl(`/portal?error=${encodeURIComponent(oauthError)}`));
  }
  if (!code || !state) {
    return NextResponse.redirect(portalAbsoluteUrl('/portal?error=missing_code'));
  }

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.set({ name: STATE_COOKIE, value: '', maxAge: 0, path: '/' });
  if (!expected || expected !== state) {
    return NextResponse.redirect(portalAbsoluteUrl('/portal?error=invalid_state'));
  }

  try {
    const token = await exchangeDiscordCode(code);
    const user = await fetchDiscordUser(token.access_token);
    const creator = await upsertCreatorFromDiscord({
      discordId: user.id,
      discordUsername: user.username,
      discordGlobalName: user.global_name,
      discordAvatar: discordAvatarUrl(user.id, user.avatar),
    });

    const sessionToken = await signCreatorSession({
      creatorId: creator.id,
      discordId: user.id,
      discordUsername: user.global_name ?? user.username,
    });

    const res = NextResponse.redirect(portalAbsoluteUrl('/portal/dashboard'));
    res.cookies.set(creatorSessionCookieOptions(sessionToken));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'auth_failed';
    if (message === 'blacklisted') {
      return NextResponse.redirect(portalAbsoluteUrl('/portal?error=blacklisted'));
    }
    return NextResponse.redirect(portalAbsoluteUrl(`/portal?error=${encodeURIComponent(message)}`));
  }
}
