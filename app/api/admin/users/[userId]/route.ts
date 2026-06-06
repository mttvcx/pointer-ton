import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/adminAuth';
import { getAdminUserProfile } from '@/lib/db/adminUsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, 'users.read');
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  try {
    const profile = await getAdminUserProfile(userId);
    if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'profile_failed';
    return NextResponse.json({ error: 'profile_failed', message }, { status: 500 });
  }
}
