import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import { listConfirmedTradesForMintUserAsc } from '@/lib/db/trades';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { traderMintStatsFromTradeRows } from '@/lib/trading/mintTopTraders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Confirmed trades for one wallet on one mint; FIFO stats for hover + profile. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? '';
  if (!isValidPublicKey(mint) || !isValidPublicKey(wallet)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', wallet)
    .maybeSingle();
  if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
  if (!user?.id) return NextResponse.json({ stats: null });

  const rows = await listConfirmedTradesForMintUserAsc(mint, user.id, 2000);
  const stats = traderMintStatsFromTradeRows(rows);
  return NextResponse.json({ stats });
}
