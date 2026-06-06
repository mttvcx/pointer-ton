import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/adminAuth';
import { listBugReports } from '@/lib/db/bugReports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'bugreports.read');
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  try {
    const reports = await listBugReports({ status: status ?? undefined });
    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
