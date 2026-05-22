import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';

export type AddressSignatureRow = {
  signature: string;
  slot: number;
  err: unknown;
  blockTime: number | null;
};

export async function getRecentSignaturesForAddress(
  address: string,
  limit = 25,
): Promise<AddressSignatureRow[]> {
  const conn = getConnection();
  const sigs = await heliusCall('getSignaturesForAddress', HELIUS_CREDITS.RPC, () =>
    conn.getSignaturesForAddress(new PublicKey(address), { limit }),
  );
  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    err: s.err,
    blockTime: s.blockTime ?? null,
  }));
}

export async function getSolBalanceLamports(address: string): Promise<bigint> {
  const conn = getConnection();
  return BigInt(
    await heliusCall('getBalance', HELIUS_CREDITS.RPC, () =>
      conn.getBalance(new PublicKey(address), 'confirmed'),
    ),
  );
}
