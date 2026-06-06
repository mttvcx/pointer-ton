import { NextResponse, type NextRequest } from 'next/server';
import { requireAnyAdmin } from '@/lib/api/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  return NextResponse.json({
    admin: {
      userId: ctx.userId,
      walletAddress: ctx.walletAddress,
      username: ctx.username,
      email: ctx.email,
      roles: ctx.roles,
      permissions: ctx.permissions,
    },
  });
}
