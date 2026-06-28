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
  // Local-dev convenience is OPT-IN only (POINTER_DEV_ADMIN=1) — never an
  // automatic "any non-prod env = admin" bypass.
  if (process.env.NODE_ENV !== 'production' && process.env.POINTER_DEV_ADMIN === '1') return true;
  return isFounderWallet(founderWallet, process.env.BETA_FOUNDER_WALLETS);
}
