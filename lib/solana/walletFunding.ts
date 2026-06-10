import 'server-only';

import { PublicKey } from '@solana/web3.js';
import {
  fetchHeliusAddressTransactions,
  type HeliusEnhancedTx,
} from '@/lib/indexer/heliusEnhanced';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';

export type WalletIncomingFunding = {
  fromAddress: string;
  signature: string;
  /** Net lamports this wallet gained in this transaction (best-effort). */
  lamportsReceived: number;
  blockTime: number | null;
};

const MIN_INCOMING_LAMPORTS = 50_000;

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('-32429');
}

function pickIncomingFromEnhancedTx(
  tx: HeliusEnhancedTx,
  walletAddress: string,
): { fromAddress: string; lamports: number } | null {
  let best = 0;
  let fromAddress: string | null = null;
  for (const n of tx.nativeTransfers ?? []) {
    const amt = n.amount ?? 0;
    if (n.toUserAccount !== walletAddress || amt < MIN_INCOMING_LAMPORTS) continue;
    if (amt > best) {
      best = amt;
      fromAddress = n.fromUserAccount?.trim() || null;
    }
  }
  if (!fromAddress || best <= 0) return null;
  return { fromAddress, lamports: best };
}

/** Helius enhanced history — 1 REST call per wallet (desk-safe). */
async function findIncomingViaEnhanced(
  walletAddress: string,
  scanLimit: number,
): Promise<WalletIncomingFunding | null> {
  const { txs } = await fetchHeliusAddressTransactions(walletAddress, { limit: scanLimit });
  for (const tx of txs) {
    const sig = tx.signature?.trim();
    if (!sig) continue;
    const hit = pickIncomingFromEnhancedTx(tx, walletAddress);
    if (!hit) continue;
    return {
      fromAddress: hit.fromAddress,
      signature: sig,
      lamportsReceived: hit.lamports,
      blockTime: tx.timestamp ?? null,
    };
  }
  return null;
}

/** Legacy RPC scan — only used when enhanced API fails for non-rate-limit reasons. */
async function findIncomingViaRpc(
  walletAddress: string,
  scanLimit: number,
): Promise<WalletIncomingFunding | null> {
  const conn = getConnection();
  const pk = new PublicKey(walletAddress);
  const sigs = await heliusCall('getSignaturesForAddress', HELIUS_CREDITS.RPC, () =>
    conn.getSignaturesForAddress(pk, { limit: scanLimit }),
  );
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await heliusCall('getTransaction', HELIUS_CREDITS.RPC, () =>
      conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }),
    );
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
    if (delta < MIN_INCOMING_LAMPORTS) continue;

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

/**
 * Find a recent transaction where the wallet's native SOL balance increased materially.
 * Prefers Helius enhanced REST (1 call/wallet); RPC fallback is best-effort.
 */
export async function findRecentIncomingSolFunding(
  walletAddress: string,
  opts?: { scanLimit?: number },
): Promise<WalletIncomingFunding | null> {
  const scanLimit = Math.min(40, Math.max(8, opts?.scanLimit ?? 24));
  try {
    const pk = new PublicKey(walletAddress);
    void pk;
  } catch {
    return null;
  }

  try {
    const enhanced = await findIncomingViaEnhanced(walletAddress, scanLimit);
    if (enhanced) return enhanced;
  } catch (err) {
    if (isRateLimitError(err)) return null;
  }

  try {
    return await findIncomingViaRpc(walletAddress, Math.min(scanLimit, 12));
  } catch (err) {
    if (isRateLimitError(err)) return null;
    throw err;
  }
}

/** Approximate on-chain activity from enhanced history length (1 REST call). */
export async function estimateWalletSignatureCount(walletAddress: string): Promise<number | null> {
  try {
    const { txs } = await fetchHeliusAddressTransactions(walletAddress, { limit: 100 });
    return txs.length;
  } catch (err) {
    if (isRateLimitError(err)) return null;
    return null;
  }
}
