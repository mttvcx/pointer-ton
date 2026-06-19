import { NextResponse, type NextRequest } from 'next/server';
import {
  assertCreatorDevLoginAllowed,
  DEV_ADMIN_DISCORD_ID,
  DEV_CREATOR_DISCORD_ID,
} from '@/lib/creators/devAuth';
import {
  addCreatorSocialAccount,
  getCreatorByDiscordId,
  listCreatorAccounts,
  markCreatorAccountVerified,
  upsertCreatorFromDiscord,
} from '@/lib/db/creators';
import {
  creatorSessionCookieOptions,
  signCreatorSession,
} from '@/lib/creators/session';
import { portalAbsoluteUrl } from '@/lib/creators/portalUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function bootstrapVerifiedAccount(creatorId: string) {
  const accounts = await listCreatorAccounts(creatorId);
  const existing = accounts.find((a) => a.platform === 'tiktok' && a.handle === 'devclip');
  if (existing) return existing;

  const account = await addCreatorSocialAccount({
    creatorId,
    platform: 'tiktok',
    handle: 'devclip',
    profileUrl: 'https://www.tiktok.com/@devclip',
  });

  await markCreatorAccountVerified(account.id, { tier: 'basic', tier1AudiencePct: 25 });

  return account;
}

export async function GET(req: NextRequest) {
  try {
    assertCreatorDevLoginAllowed();
  } catch {
    return NextResponse.json({ error: 'dev_login_disabled' }, { status: 403 });
  }

  const role = req.nextUrl.searchParams.get('role') === 'admin' ? 'admin' : 'creator';
  const bootstrap = req.nextUrl.searchParams.get('bootstrap') === '1';

  const discordId = role === 'admin' ? DEV_ADMIN_DISCORD_ID : DEV_CREATOR_DISCORD_ID;
  const discordUsername = role === 'admin' ? 'dev-admin' : 'dev-creator';

  try {
    let creator = await getCreatorByDiscordId(discordId);
    if (!creator) {
      creator = await upsertCreatorFromDiscord({
        discordId,
        discordUsername,
        discordGlobalName: role === 'admin' ? 'Dev Admin' : 'Dev Creator',
        discordAvatar: null,
      });
    }

    if (role === 'creator' && bootstrap) {
      await bootstrapVerifiedAccount(creator.id);
    }

    const sessionToken = await signCreatorSession({
      creatorId: creator.id,
      discordId,
      discordUsername: role === 'admin' ? 'Dev Admin' : 'Dev Creator',
    });

    const res = NextResponse.redirect(portalAbsoluteUrl('/portal/dashboard'));
    res.cookies.set(creatorSessionCookieOptions(sessionToken));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'dev_auth_failed';
    return NextResponse.redirect(portalAbsoluteUrl(`/portal?error=${encodeURIComponent(message)}`));
  }
}
