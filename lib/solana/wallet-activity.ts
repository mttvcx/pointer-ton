import 'server-only';

import { PublicKey, type VersionedTransactionResponse } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';

export type SolWalletActivityItem = {
  signature: string;
  slot: number;
  blockTime: number | null;
  success: boolean;
  label: string;
  sublabel: string | null;
};

function summarizeFromTx(tx: VersionedTransactionResponse | null): { label: string; sublabel: string | null } {
  if (!tx) return { label: 'Transaction', sublabel: null };
  if (tx.meta?.err) {
    return { label: 'Failed', sublabel: 'Transaction reverted or dropped' };
  }
  const logs = (tx.meta?.logMessages ?? []).join(' ').toLowerCase();
  if (logs.includes('initializemint') || logs.includes('initialize mint')) {
    return { label: 'Token created', sublabel: 'New SPL mint or pool' };
  }
  if (logs.includes('metadata') && (logs.includes('create') || logs.includes('update'))) {
    return { label: 'Metadata', sublabel: 'Token / NFT metadata' };
  }
  if (logs.includes('swap') || logs.includes('jupiter') || logs.includes('route') || logs.includes('dex')) {
    return { label: 'Swap', sublabel: 'DEX interaction' };
  }
  if (logs.includes('liquidity') || logs.includes('deposit') || logs.includes('withdraw')) {
    return { label: 'Liquidity', sublabel: null };
  }
  if (logs.includes('transfer')) {
    return { label: 'Transfer', sublabel: 'SOL or SPL movement' };
  }
  if (logs.includes('mint') || logs.includes('burn')) {
    return { label: 'Mint / burn', sublabel: null };
  }
  return { label: 'Contract call', sublabel: 'Solana program interaction' };
}

const FETCH_BATCH = 6;

/**
 * Recent on-chain activity for a Solana wallet using Helius/SOLANA_RPC (same JSON-RPC as Pulse).
 * Pulls full transactions so we can label swaps, mints, transfers — not just signatures.
 */
export async function getSolWalletActivity(address: string, limit = 22): Promise<SolWalletActivityItem[]> {
  const conn = getConnection();
  const pk = new PublicKey(address);
  const sigs = await conn.getSignaturesForAddress(pk, { limit });
  const out: SolWalletActivityItem[] = [];

  for (let i = 0; i < sigs.length; i += FETCH_BATCH) {
    const batch = sigs.slice(i, i + FETCH_BATCH);
    const txs = await Promise.all(
      batch.map((s) =>
        conn.getTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
        }),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      const s = batch[j]!;
      const tx = txs[j] ?? null;
      const { label, sublabel } = summarizeFromTx(tx);
      const sigListErr = s.err != null;
      const metaErr = tx?.meta?.err != null;
      const success = !sigListErr && !metaErr;
      out.push({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime ?? null,
        success,
        label: sigListErr ? 'Unconfirmed' : label,
        sublabel: sigListErr ? 'Not indexed or dropped before confirmation' : sublabel,
      });
    }
  }
  return out;
}
