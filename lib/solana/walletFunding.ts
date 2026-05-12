import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';

export type WalletIncomingFunding = {
  fromAddress: string;
  signature: string;
  /** Net lamports this wallet gained in this transaction (best-effort). */
  lamportsReceived: number;
  blockTime: number | null;
};

/**
 * Find a recent transaction where the wallet's native SOL balance increased materially.
 * Used for “Funded” display + Solscan link (tx, not just the counterparty account).
 */
export async function findRecentIncomingSolFunding(
  walletAddress: string,
  opts?: { scanLimit?: number },
): Promise<WalletIncomingFunding | null> {
  const scanLimit = opts?.scanLimit ?? 28;
  const conn = getConnection();
  let pk: PublicKey;
  try {
    pk = new PublicKey(walletAddress);
  } catch {
    return null;
  }

  const sigs = await conn.getSignaturesForAddress(pk, { limit: scanLimit });
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx?.meta || tx.meta.err) continue;

    const msg = tx.transaction.message as {
      staticAccountKeys?: PublicKey[];
      getAccountKeys?: () => { staticAccountKeys: PublicKey[] };
    };
    const keysRaw =
      msg.staticAccountKeys ??
      (typeof msg.getAccountKeys === 'function' ? msg.getAccountKeys()?.staticAccountKeys : undefined) ??
      [];
    const keys = keysRaw.map((k) => k.toBase58());
    const idx = keys.indexOf(walletAddress);
    if (idx < 0) continue;

    const pre = tx.meta.preBalances[idx] ?? 0;
    const post = tx.meta.postBalances[idx] ?? 0;
    const delta = post - pre;
    /** Ignore dust / rent-only noise; pick meaningful incoming SOL. */
    if (delta < 50_000) continue;

    let fromAddress = keys[0]!;
    for (let i = 0; i < keys.length; i++) {
      if (i === idx) continue;
      const ppre = tx.meta.preBalances[i] ?? 0;
      const ppost = tx.meta.postBalances[i] ?? 0;
      if (ppre - ppost >= delta * 0.85) {
        fromAddress = keys[i]!;
        break;
      }
    }

    return {
      fromAddress,
      signature: s.signature,
      lamportsReceived: delta,
      blockTime: s.blockTime ?? null,
    };
  }

  return null;
}
