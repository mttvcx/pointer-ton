import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { searchIdentities, searchWallets } from '@/lib/identity/identityService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    q: req.nextUrl.searchParams.get('q'),
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const limit = parsed.data.limit ?? 20;
  const profiles = searchIdentities(parsed.data.q, limit);
  const wallets = searchWallets(parsed.data.q, limit);

  return NextResponse.json({
    query: parsed.data.q,
    profiles,
    wallets,
  });
}
