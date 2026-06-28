import 'server-only';

import { PrivyClient } from '@privy-io/node';
import { verifyPointerAccessToken } from '@/lib/auth/pointerSession';
import { assertNotRevoked } from '@/lib/auth/revocation';
import { getUserByPrivyId } from '@/lib/db/users';
import { PRIVY_APP_ID } from '@/lib/privy/appId';

export { PRIVY_APP_ID } from '@/lib/privy/appId';

function requireServerPrivyEnv() {
  const appId = PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET missing on server');
  }
  return { appId, appSecret };
}

/** Verify Privy bearer via official SDK (correct JWKS host + identity-token fallback). */
async function verifyPrivyBearerToken(token: string): Promise<{ privyId: string }> {
  const auth = getPrivyServerClient().utils().auth();
  try {
    const result = await auth.verifyAccessToken(token);
    return { privyId: result.user_id };
  } catch {
    const user = await auth.verifyIdentityToken(token);
    return { privyId: user.id };
  }
}

export interface VerifiedPrivyUser {
  privyId: string;
  walletAddress: string;
}

export async function verifyPrivyAccessToken(token: string): Promise<VerifiedPrivyUser> {
  let privyId: string;
  let walletAddress: string;
  let iatSeconds: number | undefined;
  try {
    const v = await verifyPointerAccessToken(token);
    privyId = v.authSubject;
    walletAddress = v.walletAddress;
    iatSeconds = v.iatSeconds;
  } catch {
    const verified = await verifyPrivyBearerToken(token);
    privyId = verified.privyId;
    const user = await getUserByPrivyId(privyId);
    walletAddress = user?.wallet_address ?? '';
    // Privy bearers are short-lived and don't surface `iat`; they rely on natural
    // expiry rather than the revocation cutoff.
  }
  // Single revocation chokepoint for every authed route (fail-open).
  await assertNotRevoked(privyId, iatSeconds);
  return { privyId, walletAddress };
}

export async function verifyPrivyJwksOnly(token: string): Promise<{ privyId: string }> {
  return verifyPrivyBearerToken(token);
}

let _privy: PrivyClient | null = null;
export function getPrivyServerClient(): PrivyClient {
  if (_privy) return _privy;
  const { appId, appSecret } = requireServerPrivyEnv();
  _privy = new PrivyClient({ appId, appSecret });
  return _privy;
}
