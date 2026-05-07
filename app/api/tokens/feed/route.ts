import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPulseFeed } from '@/lib/helius/feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  column: z.enum(['new', 'stretch', 'migrated']).default('new'),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    column: req.nextUrl.searchParams.get('column') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }
  const { column } = parsed.data;
  try {
    const items = await getPulseFeed(column);
    return NextResponse.json({ column, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'feed failed';
    return NextResponse.json({ error: 'feed_failed', message }, { status: 500 });
  }
}
