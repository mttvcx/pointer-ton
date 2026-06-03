import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { getSocialAccountById, insertVerificationSubmission, uploadVerificationToStorage } from '@/lib/db/creators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(['video/mp4', 'video/quicktime']);

export async function POST(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const form = await req.formData();
  const accountId = form.get('accountId');
  const file = form.get('file');

  if (typeof accountId !== 'string' || !(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const parsedId = z.string().uuid().safeParse(accountId);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'invalid_account_id' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', maxMb: 50 }, { status: 400 });
  }

  const mime = file.type || 'video/mp4';
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: 'invalid_mime', allowed: [...ALLOWED] }, { status: 400 });
  }

  const account = await getSocialAccountById(parsedId.data);
  if (!account || account.creator_id !== auth.creator!.id) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await uploadVerificationToStorage(
    auth.creator!.id,
    account.id,
    buffer,
    mime,
  );

  const submission = await insertVerificationSubmission({
    accountId: account.id,
    creatorId: auth.creator!.id,
    storagePath,
    fileSizeBytes: file.size,
    mimeType: mime,
  });

  return NextResponse.json({ submissionId: submission.id, status: 'pending' });
}
