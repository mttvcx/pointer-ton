import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { submitCommunityLabel } from '@/lib/ext/communityLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Crowdsource a tag — the user submits a label for an @handle or wallet. It joins
 * the community pool; once enough distinct users agree it surfaces publicly for
 * everyone (see communityLabels.ts). One submission per user per subject.
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
    await submitCommunityLabel({ userId: auth.userId, subjectType, subject, label, category });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'submit_failed' }, { status: 500 });
  }
}
