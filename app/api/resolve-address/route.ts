import { NextResponse, type NextRequest } from 'next/server';
import { resolveAddressKind } from '@/lib/solana/address-kind';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!address || !isValidPublicKey(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  try {
    const kind = await resolveAddressKind(address);
    return NextResponse.json({ address, kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resolve_failed';
    return NextResponse.json({ error: 'resolve_failed', message }, { status: 502 });
  }
}
