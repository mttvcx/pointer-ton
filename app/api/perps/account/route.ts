import { NextResponse, type NextRequest } from 'next/server';
import { fetchClearinghouseState } from '@/lib/hyperliquid/infoClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * A user's live Hyperliquid perps account (margin + open positions), keyed by
 * their EVM address. Public read off the HL info API — no signing. The client
 * passes its Privy embedded EVM address; we validate the format and normalize the
 * stringy HL numbers into a compact shape for the order panel + positions table.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  try {
    const state = await fetchClearinghouseState(address);
    const positions = state.assetPositions
      .map((p) => p.position)
      .filter((p) => Number(p.szi) !== 0)
      .map((p) => ({
        coin: p.coin,
        szi: Number(p.szi),
        entryPx: p.entryPx != null ? Number(p.entryPx) : null,
        positionValue: p.positionValue != null ? Number(p.positionValue) : null,
        unrealizedPnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : null,
        liquidationPx: p.liquidationPx != null ? Number(p.liquidationPx) : null,
        marginUsed: p.marginUsed != null ? Number(p.marginUsed) : null,
        leverage: p.leverage?.value ?? null,
      }));

    return NextResponse.json({
      accountValue: Number(state.marginSummary.accountValue) || 0,
      withdrawable: state.withdrawable != null ? Number(state.withdrawable) || 0 : 0,
      totalMarginUsed:
        state.marginSummary.totalMarginUsed != null ? Number(state.marginSummary.totalMarginUsed) || 0 : 0,
      positions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'account_lookup_failed' },
      { status: 502 },
    );
  }
}
