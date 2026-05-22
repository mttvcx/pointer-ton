import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { isFounderWallet } from '@/lib/beta/founder';

export function authorizeAdminRequest(
  req: NextRequest,
  founderWallet: string | null | undefined,
): boolean {
  const secret = process.env.POINTER_ADMIN_SECRET?.trim();
  if (secret) {
    const header = req.headers.get('x-pointer-admin-secret')?.trim();
    if (!header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  if (process.env.NODE_ENV !== 'production') return true;
  return isFounderWallet(founderWallet, process.env.BETA_FOUNDER_WALLETS);
}
