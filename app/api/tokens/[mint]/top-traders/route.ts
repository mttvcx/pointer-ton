import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { buildMintTopTraders } from '@/lib/trading/mintTopTraders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRADES = 8000;

/** Token-scoped top traders: realized PnL on this mint (FIFO), last 30 days. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
  const cutoffMs = Date.now() - WINDOW_MS;

  const supabase = createAdminSupabase();
  const { data: trades, error } = await supabase
    .from('trades')
    .select('user_id, side, amount_token, price_usd_at_fill, confirmed_at, submitted_at')
    .eq('mint', mint)
    .eq('status', 'confirmed')
    .order('submitted_at', { ascending: true })
    .limit(MAX_TRADES);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = trades ?? [];
  if (rows.length === 0) return NextResponse.json({ traders: [] });

  const userIds = [...new Set(rows.map((t) => t.user_id))];
  const userIdToWallet = new Map<string, string>();

  const chunk = 200;
  for (let i = 0; i < userIds.length; i += chunk) {
    const slice = userIds.slice(i, i + chunk);
    const { data: users, error: ue } = await supabase
      .from('users')
      .select('id, wallet_address')
      .in('id', slice);
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
    for (const u of users ?? []) {
      if (u.wallet_address) userIdToWallet.set(u.id, u.wallet_address);
    }
  }

  const traders = buildMintTopTraders({
    trades: rows,
    userIdToWallet,
    cutoffMs,
    limit,
  });

  return NextResponse.json({ traders });
}
