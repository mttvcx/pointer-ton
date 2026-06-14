import 'server-only';

import { insertAlert } from '@/lib/db/alerts';
import { notifyUserWebPush } from '@/lib/push/notifyUser';
import { getTrackedWallet, listUserIdsTrackingWallet } from '@/lib/db/wallets';
import { getTokenByMint } from '@/lib/db/tokens';
import { parseTrackedWalletSwapsFromTx } from '@/lib/helius/parseTrackedWalletSwaps';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import { prepareIdentityRegistry } from '@/lib/identity/importPersisted';

export type TrackedWalletTradeAlertReport = {
  swapsSeen: number;
  alerts: number;
};

/**
 * Match Helius enhanced swap txs against tracked_wallets + identity registry;
 * insert alerts and optional web push for live tracker toasts.
 */
export async function processTrackedWalletTradeAlerts(
  txRaw: unknown,
  txSignature: string,
): Promise<TrackedWalletTradeAlertReport> {
  await prepareIdentityRegistry();
  const swaps = parseTrackedWalletSwapsFromTx(txRaw);
  if (swaps.length === 0) return { swapsSeen: 0, alerts: 0 };

  let alerts = 0;
  const seenUserWallet = new Set<string>();

  for (const swap of swaps) {
    const userIds = await listUserIdsTrackingWallet(swap.wallet);
    if (userIds.length === 0) continue;

    const token = await getTokenByMint(swap.mint);
    const identity = resolveWalletIdentity({ chain: 'sol', address: swap.wallet });
    const walletLabel =
      identity.manualOverride || identity.displayName !== identity.shortAddress
        ? identity.displayName
        : swap.wallet.slice(0, 6);

    for (const userId of userIds) {
      const dedupeKey = `${userId}:${swap.wallet}:${swap.signature}`;
      if (seenUserWallet.has(dedupeKey)) continue;
      seenUserWallet.add(dedupeKey);

      const tracked = await getTrackedWallet(userId, swap.wallet);
      if (!tracked || tracked.notify === false) continue;

      await insertAlert({
        user_id: userId,
        type: 'tracked_wallet_trade',
        payload: {
          wallet: swap.wallet,
          walletLabel,
          mint: swap.mint,
          symbol: token?.symbol ?? null,
          side: swap.side,
          solAmount: swap.solAmount,
          usdAmount: swap.usdAmount,
          marketCapUsd: swap.marketCapUsd,
          signature: txSignature || swap.signature,
          identityId: identity.identityId,
          isKol: identity.badges.includes('KOL'),
          blockTime: swap.blockTime,
        },
      });

      const sym = token?.symbol ? `$${token.symbol}` : swap.mint.slice(0, 8);
      const action = swap.side === 'buy' ? 'bought' : 'sold';
      await notifyUserWebPush(userId, {
        title: `${walletLabel} ${action}`,
        body: `${swap.solAmount.toFixed(3)} SOL · ${sym}`,
        url: `/token/${encodeURIComponent(swap.mint)}`,
      });
      alerts += 1;
    }
  }

  return { swapsSeen: swaps.length, alerts };
}
