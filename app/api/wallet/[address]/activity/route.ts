import { NextResponse, type NextRequest } from 'next/server';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getSolWalletActivity } from '@/lib/solana/wallet-activity';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lazy on-chain activity — only invoked when a user navigates to a wallet page
 * (client fetch on mount). Never used during Pulse / webhook feed ingestion.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  const trimmed = address.trim();

  if (!isValidPublicKey(trimmed) || inferMintKind(trimmed) !== 'sol') {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  try {
    const activity = await getSolWalletActivity(trimmed, 22);
    return NextResponse.json({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'activity_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
