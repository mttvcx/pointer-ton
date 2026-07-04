import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import {
  expireDueLimitOrders,
  listOpenLimitOrdersCron,
  markLimitOrderTriggered,
} from '@/lib/db/limitOrders';
import { notifyLimitOrderTriggered } from '@/lib/db/limitOrderNotifications';
import { firePriceRules } from '@/lib/alerts/automationEngine';
import { withOpsSpan } from '@/lib/ops/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await withOpsSpan(
      'cron',
      'check-limit-alerts',
      async () => {
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
            order.side === 'buy' ? spot <= trig : order.side === 'sell' ? spot >= trig : false;

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

        // Price automation rules (alert_rules trigger_type='price') fire from the
        // same tick — detect + notify + push; execution is Layer C.
        const priceRulesFired = await firePriceRules().catch(() => 0);

        return { expired, checked: open.length, triggered, priceRulesFired };
      },
      { metric: 'cron.duration_ms' },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cron_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
