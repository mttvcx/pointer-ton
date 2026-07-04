import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { submitCommunityLabel } from '@/lib/ext/communityLabels';
import { isActiveAdmin } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Submit a tag for an @handle or wallet. A normal user's tag joins the community
 * pool and surfaces once enough distinct users agree. An ADMIN's tag is trusted —
 * it auto-applies immediately (source 'admin', auto-verified).
 */
export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let body: { subjectType?: unknown; subject?: unknown; label?: unknown; category?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const subjectType = body.subjectType === 'wallet' ? 'wallet' : 'handle';
  const subject = typeof body.subject === 'string' ? body.subject : '';
  const label = typeof body.label === 'string' ? body.label : '';
  const category = typeof body.category === 'string' ? body.category : null;
  if (!subject.trim() || !label.trim()) {
    return NextResponse.json({ error: 'subject_and_label_required' }, { status: 400 });
  }

  try {
    const admin = await isActiveAdmin(auth.userId).catch(() => false);
    await submitCommunityLabel({
      userId: auth.userId,
      subjectType,
      subject,
      label,
      category,
      source: admin ? 'admin' : 'user',
      autoVerified: admin,
    });
    return NextResponse.json({ ok: true, applied: admin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'submit_failed' }, { status: 500 });
  }
}
