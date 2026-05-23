import 'server-only';
import { Connection, type Commitment } from '@solana/web3.js';
import { getHeliusRpcUrl } from '@/lib/utils/constants';

let _connection: Connection | null = null;
let _publicConnection: Connection | null = null;

/** Shared JSON-RPC connection to Helius (`HELIUS_API_KEY` → mainnet.helius-rpc.com). */
export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  if (!_connection) {
    _connection = new Connection(getHeliusRpcUrl(), {
      commitment,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _connection;
}

/** Free mainnet read RPC — used when Helius quota is exhausted (429). */
export function getPublicSolanaConnection(commitment: Commitment = 'confirmed'): Connection {
  if (!_publicConnection) {
    const url = process.env.SOLANA_PUBLIC_RPC_URL?.trim() ?? 'https://api.mainnet-beta.solana.com';
    _publicConnection = new Connection(url, {
      commitment,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _publicConnection;
}

export function isRpcQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many requests|max usage reached|rate limit/i.test(msg);
}
