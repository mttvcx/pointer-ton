import { NextResponse, type NextRequest } from 'next/server';
import { listRecentSocialForMint } from '@/lib/db/social';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  try {
    const mentions = await listRecentSocialForMint(mint, 30);
    return NextResponse.json({ mint, mentions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'social_failed';
    return NextResponse.json({ error: 'social_failed', message }, { status: 500 });
  }
}
