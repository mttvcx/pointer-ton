import 'server-only';

import { verifyPointerAccessToken } from '@/lib/auth/pointerSession';

/**
 * Compatibility shim: existing API routes call this `verifyPrivyAccessToken`
 * and read `privyId`; Pointer TON stores TonConnect subjects in the same
 * `users.privy_id` column (`ton:…`) and issues Pointer session JWTs.
 */
export interface VerifiedPrivyUser {
  privyId: string;
  walletAddress: string;
}

export async function verifyPrivyAccessToken(token: string): Promise<VerifiedPrivyUser> {
  const v = await verifyPointerAccessToken(token);
  return { privyId: v.authSubject, walletAddress: v.walletAddress };
}
