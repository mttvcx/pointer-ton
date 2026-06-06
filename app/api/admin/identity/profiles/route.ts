import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { createIdentityProfile, listIdentityProfiles } from '@/lib/db/identities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateBody = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    twitterHandle: z.string().trim().max(80).optional(),
    telegramHandle: z.string().trim().max(80).optional(),
    websiteUrl: z.string().trim().url().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
    primaryCategory: z.string().trim().max(40).optional(),
    verified: z.boolean().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'identity.read');
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? undefined;
  try {
    const profiles = await listIdentityProfiles({ search: search ?? undefined });
    return NextResponse.json({ profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'identity.write');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const profile = await createIdentityProfile(body);
    await logAdminAction({
      ctx: auth.ctx,
      action: 'identity.profile.create',
      targetType: 'identity_profile',
      targetId: profile.id,
      metadata: { displayName: body.displayName },
      ip: auth.ip,
    });
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    return NextResponse.json({ error: 'create_failed', message }, { status: 500 });
  }
}
