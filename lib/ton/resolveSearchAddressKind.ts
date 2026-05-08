import 'server-only';

import { fetchTonApiJettonByMaster } from '@/lib/ton/tonApi';

/**
 * Best-effort routing for global search: jetton masters open `/token/…`, user wallets `/wallet/…`.
 * Uses TonAPI when available; falls back to `wallet` if the API errors or returns no jetton record.
 */
export async function resolveTonSearchAddressKind(canonAddress: string): Promise<'mint' | 'wallet'> {
  try {
    const j = await fetchTonApiJettonByMaster(canonAddress);
    if (j) return 'mint';
  } catch {
    /* TonAPI down — prefer wallet route */
  }
  return 'wallet';
}
