import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listTokensByImageUrl } from '@/lib/db/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  imageUrl: z.string().trim().min(8).max(2048),
  excludeMint: z.string().trim().min(8).max(128).optional(),
});

/**
 * Tokens that share the same `image_url` — powers Pulse avatar "Reused Image Tokens" hover.
 */
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    imageUrl: req.nextUrl.searchParams.get('imageUrl') ?? undefined,
    excludeMint: req.nextUrl.searchParams.get('excludeMint') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { items, total } = await listTokensByImageUrl(parsed.data.imageUrl, {
      excludeMint: parsed.data.excludeMint,
      limit: 12,
    });
    return NextResponse.json({ items, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reused_image_failed';
    return NextResponse.json({ error: 'reused_image_failed', message }, { status: 500 });
  }
}
