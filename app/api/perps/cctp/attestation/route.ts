import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_CCTP_DOMAIN, fetchCctpAttestation } from '@/lib/hyperliquid/cctp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Solana tx signature (base58). */
const SOL_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;

/**
 * Read-only proxy to Circle Iris for a CCTP burn's attestation status, keyed by
 * the Solana burn tx signature. No funds move here — this is how the client
 * tracks a Solana→Hyperliquid transfer to completion. Burn step lands separately.
 */
export async function GET(req: NextRequest) {
  const tx = req.nextUrl.searchParams.get('tx')?.trim() ?? '';
  if (!SOL_SIG_RE.test(tx)) {
    return NextResponse.json({ error: 'invalid_tx' }, { status: 400 });
  }
  try {
    const messages = await fetchCctpAttestation(SOLANA_CCTP_DOMAIN, tx);
    const ready = messages.some((m) => m.status === 'complete' && m.attestation);
    return NextResponse.json({ ready, messages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'attestation_failed' },
      { status: 502 },
    );
  }
}
