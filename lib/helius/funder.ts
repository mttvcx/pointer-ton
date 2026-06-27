import 'server-only';

import { getHeliusRpcUrl } from '@/lib/utils/constants';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';

async function rpc<T>(method: string, params: unknown): Promise<T | null> {
  return heliusCall(`funder:${method}`, HELIUS_CREDITS.RPC, async () => {
    const url = getHeliusRpcUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'pointer-funder', method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error?.message) throw new Error(json.error.message);
    return (json.result ?? null) as T | null;
  });
}

const SYS_PROGRAM = '11111111111111111111111111111111';

/**
 * Best-effort: the wallet that first funded `wallet` (sender of the earliest SOL
 * inflow). Two standard RPC calls (1 credit each), cached forever upstream. Returns
 * null when it can't be determined cheaply — we do NOT paginate past the first
 * signatures page, so very old/active wallets resolve to null rather than burning
 * Helius credits.
 */
export async function resolveFunderWallet(wallet: string): Promise<string | null> {
  const sigs = await rpc<Array<{ signature: string }>>('getSignaturesForAddress', [
    wallet,
    { limit: 1000 },
  ]);
  if (!sigs?.length) return null;
  const oldest = sigs[sigs.length - 1]!.signature;

  const tx = await rpc<{
    transaction?: { message?: { accountKeys?: Array<string | { pubkey: string }> } };
    meta?: { preBalances?: number[]; postBalances?: number[] } | null;
  }>('getTransaction', [oldest, { maxSupportedTransactionVersion: 0, encoding: 'json' }]);

  const keys = tx?.transaction?.message?.accountKeys;
  const pre = tx?.meta?.preBalances;
  const post = tx?.meta?.postBalances;
  if (!keys || !pre || !post || keys.length !== pre.length || keys.length !== post.length) {
    return null;
  }

  const addr = (k: string | { pubkey: string }) => (typeof k === 'string' ? k : k.pubkey);
  const walletIdx = keys.findIndex((k) => addr(k) === wallet);
  if (walletIdx < 0) return null;
  // The wallet must have RECEIVED lamports in its first tx for this to be a funding.
  if (!(post[walletIdx]! > pre[walletIdx]!)) return null;

  // Funder = the account with the biggest lamport drop (the payer/sender),
  // excluding the wallet itself and the system program.
  let funder: string | null = null;
  let maxDrop = 0;
  for (let i = 0; i < keys.length; i++) {
    if (i === walletIdx) continue;
    const a = addr(keys[i]!);
    if (a === SYS_PROGRAM) continue;
    const drop = pre[i]! - post[i]!;
    if (drop > maxDrop) {
      maxDrop = drop;
      funder = a;
    }
  }
  return funder;
}
