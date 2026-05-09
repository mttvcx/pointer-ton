import 'server-only';

import { createRemoteJWKSet } from 'jose';
import { PrivyClient, verifyAccessToken } from '@privy-io/node';
import { verifyPointerAccessToken } from '@/lib/auth/pointerSession';
import { getUserByPrivyId } from '@/lib/db/users';
import { PRIVY_APP_ID } from '@/lib/privy/publicConfig';

export { PRIVY_APP_ID } from '@/lib/privy/publicConfig';

function requireServerPrivyEnv() {
  const appId = PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET missing on server');
  }
  return { appId, appSecret };
}

const PRIVY_JWKS_URL = (appId: string) =>
  new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`);

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(appId: string) {
  if (_jwks) return _jwks;
  _jwks = createRemoteJWKSet(PRIVY_JWKS_URL(appId), {
    cacheMaxAge: 60 * 60 * 1_000,
    cooldownDuration: 30_000,
  });
  return _jwks;
}

export interface VerifiedPrivyUser {
  privyId: string;
  walletAddress: string;
}

export async function verifyPrivyAccessToken(token: string): Promise<VerifiedPrivyUser> {
  try {
    const v = await verifyPointerAccessToken(token);
    return { privyId: v.authSubject, walletAddress: v.walletAddress };
  } catch {
    const { appId } = requireServerPrivyEnv();
    const result = await verifyAccessToken({
      access_token: token,
      app_id: appId,
      verification_key: getJwks(appId),
    });
    const user = await getUserByPrivyId(result.user_id);
    return {
      privyId: result.user_id,
      walletAddress: user?.wallet_address ?? '',
    };
  }
}

export async function verifyPrivyJwksOnly(token: string): Promise<{ privyId: string }> {
  const { appId } = requireServerPrivyEnv();
  const result = await verifyAccessToken({
    access_token: token,
    app_id: appId,
    verification_key: getJwks(appId),
  });
  return { privyId: result.user_id };
}

let _privy: PrivyClient | null = null;
export function getPrivyServerClient(): PrivyClient {
  if (_privy) return _privy;
  const { appId, appSecret } = requireServerPrivyEnv();
  _privy = new PrivyClient({ appId, appSecret });
  return _privy;
}
