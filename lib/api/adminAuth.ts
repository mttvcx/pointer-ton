import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { resolveAdminContext, type AdminContext } from '@/lib/db/admin';
import { hasPermission, type AdminPermission, ADMIN_WILDCARD } from '@/lib/admin/permissions';

export type AdminAuthOk = { ok: true; ctx: AdminContext; ip: string | null };
export type AdminAuthErr = { ok: false; response: NextResponse };

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip')?.trim() || null;
}

function breakGlassContext(req: NextRequest): AdminContext | null {
  const secret = process.env.POINTER_ADMIN_SECRET?.trim();
  if (!secret) return null;
  const header = req.headers.get('x-pointer-admin-secret')?.trim();
  if (!header) return null;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  // Break-glass acts as a synthetic system superadmin. Audit rows attribute to
  // 'system' (no admin_user_id) so the access is still traceable.
  return {
    adminUserId: '',
    userId: 'system',
    walletAddress: null,
    username: 'system',
    email: null,
    isActive: true,
    roles: [{ key: 'superadmin', name: 'System (break-glass)' }],
    permissions: [ADMIN_WILDCARD],
  };
}

/**
 * Resolve admin context for a request without checking a specific permission.
 * Used by the `/admin` shell and `/api/admin/me`. Still rejects non-admins.
 */
export async function requireAnyAdmin(
  req: NextRequest,
): Promise<AdminAuthOk | AdminAuthErr> {
  const ip = clientIp(req);

  const bg = breakGlassContext(req);
  if (bg) return { ok: true, ctx: bg, ip };

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return { ok: false, response: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }) };
  }

  let privyId: string;
  let walletAddress: string;
  try {
    const v = await verifyPrivyAccessToken(accessToken);
    privyId = v.privyId;
    walletAddress = v.walletAddress;
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }

  const user = await getUserByPrivyId(privyId);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'user_not_synced' }, { status: 403 }) };
  }

  const ctx = await resolveAdminContext(
    user.id,
    user.wallet_address ?? walletAddress ?? null,
    user.username ?? null,
    user.email ?? null,
  );
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'not_admin' }, { status: 403 }) };
  }
  return { ok: true, ctx, ip };
}

/**
 * Gate an admin route. Resolves the Privy user, loads their admin RBAC context,
 * and checks `required` permission. Falls back to the POINTER_ADMIN_SECRET
 * break-glass (synthetic superadmin) when present.
 */
export async function requireAdmin(
  req: NextRequest,
  required: AdminPermission,
): Promise<AdminAuthOk | AdminAuthErr> {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth;
  if (!hasPermission(auth.ctx.permissions, required)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden', required }, { status: 403 }),
    };
  }
  return auth;
}
