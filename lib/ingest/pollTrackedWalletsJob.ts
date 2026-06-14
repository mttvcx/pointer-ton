import 'server-only';

import { fetchHeliusAddressTransactions } from '@/lib/indexer/heliusEnhanced';
import { processTrackedWalletTradeAlerts } from '@/lib/helius/trackedWalletTradeAlerts';
import { listDistinctTrackedWalletAddresses } from '@/lib/db/wallets';

const BATCH = 25;

export async function runPollTrackedWallets(): Promise<{
  walletsPolled: number;
  txsSeen: number;
  alerts: number;
}> {
  if (!process.env.HELIUS_API_KEY?.trim()) {
    return { walletsPolled: 0, txsSeen: 0, alerts: 0 };
  }

  const wallets = await listDistinctTrackedWalletAddresses(BATCH);
  let txsSeen = 0;
  let alerts = 0;

  for (const wallet of wallets) {
    try {
      const { txs } = await fetchHeliusAddressTransactions(wallet, { limit: 8 });
      txsSeen += txs.length;
      for (const tx of txs) {
        const sig = tx.signature?.trim() ?? '';
        const report = await processTrackedWalletTradeAlerts(tx, sig);
        alerts += report.alerts;
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.warn('[poll-tracked-wallets] wallet failed', wallet.slice(0, 8), err);
    }
  }

  return { walletsPolled: wallets.length, txsSeen, alerts };
}
