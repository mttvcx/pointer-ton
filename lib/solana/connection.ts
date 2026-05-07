import 'server-only';
import { Connection, type Commitment } from '@solana/web3.js';
import { getHeliusRpcUrl } from '@/lib/utils/constants';

let _connection: Connection | null = null;

/** Shared JSON-RPC connection to Helius (or `SOLANA_RPC_URL` override). */
export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  if (!_connection) {
    _connection = new Connection(getHeliusRpcUrl(), {
      commitment,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _connection;
}
