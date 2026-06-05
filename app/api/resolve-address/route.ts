import { NextResponse, type NextRequest } from 'next/server';
import { resolveEnsToAddress } from '@/lib/ethereum/ensResolve';
import { isValidGlobalSearchQuery, looksLikeEnsName, normalizeEvmAddress } from '@/lib/ethereum/EthereumSearch';
import { resolveEvmSearchAddressKind } from '@/lib/evm/resolveEvmSearchAddressKind';
import { resolveAddressKind } from '@/lib/solana/address-kind';
import { resolveTonSearchAddressKind } from '@/lib/ton/resolveSearchAddressKind';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let raw = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!raw || !isValidGlobalSearchQuery(raw)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  if (looksLikeEnsName(raw)) {
    const resolved = await resolveEnsToAddress(raw);
    if (!resolved) {
      return NextResponse.json({ error: 'ens_not_found' }, { status: 404 });
    }
    raw = resolved;
  }

  const evm = normalizeEvmAddress(raw);
  if (evm) {
    const kind = await resolveEvmSearchAddressKind(evm);
    return NextResponse.json({ address: evm, kind });
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
