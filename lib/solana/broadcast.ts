import 'server-only';

import {
  getConnection,
  getPublicSolanaConnection,
  isRpcQuotaError,
} from '@/lib/solana/connection';

/**
 * Broadcast a fully-signed Solana transaction through the server's private
 * Helius RPC, returning the on-chain signature.
 *
 * Why server-side: the browser (Privy embedded-wallet `signAndSendTransaction`)
 * broadcasts through `getClientSolanaRpcUrls()`, which falls back to the public
 * `api.mainnet-beta.solana.com` when the client RPC env is unset — and that
 * endpoint rejects `sendTransaction` with Solana error #8100002. The client
 * signs only; the server relays the raw bytes through Helius (public-RPC
 * fallback on a quota error). Mirrors the pack pay-broadcast split.
 */
export async function broadcastSignedTransaction(
  serialized: Uint8Array | Buffer,
  opts?: { skipPreflight?: boolean },
): Promise<string> {
  const raw = Buffer.isBuffer(serialized) ? serialized : Buffer.from(serialized);
  const skipPreflight = opts?.skipPreflight ?? false;
  const send = (conn: ReturnType<typeof getConnection>) =>
    conn.sendRawTransaction(raw, { skipPreflight, maxRetries: 5 });

  try {
    return await send(getConnection());
  } catch (err) {
    if (!isRpcQuotaError(err)) throw err;
    return await send(getPublicSolanaConnection());
  }
}
