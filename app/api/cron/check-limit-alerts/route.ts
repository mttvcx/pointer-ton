import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import {
  expireDueLimitOrders,
  listOpenLimitOrdersCron,
  markLimitOrderTriggered,
} from '@/lib/db/limitOrders';
import { notifyLimitOrderTriggered } from '@/lib/db/limitOrderNotifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const expired = await expireDueLimitOrders();
    const open = await listOpenLimitOrdersCron();
    const mints = [...new Set(open.map((o) => o.mint))];
    const prices = mints.length > 0 ? await fetchUsdPricesForMints(mints) : new Map();

    let triggered = 0;
    for (const order of open) {
      const spot = prices.get(order.mint)?.usdPrice;
      if (spot == null || !Number.isFinite(spot)) continue;

      const trig = Number(order.trigger_price_usd);
      if (!Number.isFinite(trig)) continue;

      const hit =
        order.side === 'buy'
          ? spot <= trig
          : order.side === 'sell'
            ? spot >= trig
            : false;

      if (!hit) continue;

      try {
        await markLimitOrderTriggered(order.id, spot);
        await notifyLimitOrderTriggered({
          userId: order.user_id,
          orderId: order.id,
          mint: order.mint,
          side: order.side,
          spotUsd: spot,
          triggerUsd: trig,
        });
        triggered += 1;
      } catch {
        /* concurrent or already processed */
      }
    }

    return NextResponse.json({ ok: true, expired, checked: open.length, triggered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cron_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
