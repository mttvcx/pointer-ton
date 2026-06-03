import 'server-only';

const DISCORD_API = 'https://discord.com/api/v10';

export function discordOAuthConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error('DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, NEXT_PUBLIC_APP_URL required');
  }
  const redirectUri = `${appUrl}/api/creators/auth/discord/callback`;
  return { clientId, clientSecret, redirectUri, appUrl };
}

export function discordAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = discordOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'consent',
  });
  return `${DISCORD_API}/oauth2/authorize?${params}`;
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret, redirectUri } = discordOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('discord_token_exchange_failed');
  return (await res.json()) as { access_token: string };
}

export async function fetchDiscordUser(accessToken: string) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('discord_user_fetch_failed');
  return (await res.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
}

export function discordAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}
