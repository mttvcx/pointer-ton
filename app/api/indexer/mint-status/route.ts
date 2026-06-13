import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { getMintIndexStatus } from '@/lib/db/mintIndexStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Q = z.object({ mint: z.string().min(32).max(60) });

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = Q.safeParse({ mint: sp.get('mint') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ status: null, reason: 'invalid_mint' }, { status: 400 });
  }
  if (!isValidPublicKey(parsed.data.mint)) {
    return NextResponse.json({ status: null, reason: 'invalid_pubkey' }, { status: 400 });
  }
  const status = await getMintIndexStatus(parsed.data.mint);
  return NextResponse.json({ status });
}
