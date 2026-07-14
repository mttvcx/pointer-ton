import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection, getPublicSolanaConnection } from '@/lib/solana/connection';
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
  const pk = new PublicKey(address);
  try {
    const conn = getConnection();
    return BigInt(
      await heliusCall('getBalance', HELIUS_CREDITS.RPC, () => conn.getBalance(pk, 'confirmed')),
    );
  } catch (err) {
    // Helius rate-limited / out of credits (or otherwise erroring) → free public RPC
    // so balances still refresh instead of falling back to a stale DB value.
    try {
      return BigInt(await getPublicSolanaConnection().getBalance(pk, 'confirmed'));
    } catch {
      throw err;
    }
  }
}
