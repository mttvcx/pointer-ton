import 'server-only';
import { insertAlert } from '@/lib/db/alerts';
import { notifyUserWebPush } from '@/lib/push/notifyUser';

export async function notifyLimitOrderTriggered(args: {
  userId: string;
  orderId: string;
  mint: string;
  side: string;
  spotUsd: number;
  triggerUsd: number;
}): Promise<void> {
  await insertAlert({
    user_id: args.userId,
    type: 'limit_alert_triggered',
    payload: {
      order_id: args.orderId,
      mint: args.mint,
      side: args.side,
      spot_price_usd: args.spotUsd,
      trigger_price_usd: args.triggerUsd,
      deeplink: `/token/${args.mint}?limitOrder=${args.orderId}`,
    },
    ai_narration: null,
  });

  const url = `/token/${args.mint}?limitOrder=${encodeURIComponent(args.orderId)}`;
  await notifyUserWebPush(args.userId, {
    title: 'Limit order hit',
    body: `${args.side.toUpperCase()} near $${args.spotUsd.toFixed(6)} (target $${args.triggerUsd.toFixed(6)})`,
    url,
  });
}
