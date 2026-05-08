import { NextResponse, type NextRequest } from 'next/server';
import { resolveAddressKind } from '@/lib/solana/address-kind';
import { resolveTonSearchAddressKind } from '@/lib/ton/resolveSearchAddressKind';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!raw || !isValidPublicKey(raw)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  const tonCanon = normalizeTonAddress(raw);
  if (tonCanon) {
    try {
      const kind = await resolveTonSearchAddressKind(tonCanon);
      return NextResponse.json({ address: tonCanon, kind });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'resolve_failed';
      return NextResponse.json({ error: 'resolve_failed', message }, { status: 502 });
    }
  }

  try {
    const kind = await resolveAddressKind(raw);
    return NextResponse.json({ address: raw, kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resolve_failed';
    return NextResponse.json({ error: 'resolve_failed', message }, { status: 502 });
  }
}
