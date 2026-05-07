import 'server-only';

import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';

export type ResolvedAddressKind = 'mint' | 'wallet';

/**
 * Classify an on-chain address for search / routing.
 * SPL mints (classic + Token-2022) ? `mint`; everything else ? `wallet`.
 */
export async function resolveAddressKind(address: string): Promise<ResolvedAddressKind> {
  const conn = getConnection();
  const pk = new PublicKey(address);
  const res = await conn.getParsedAccountInfo(pk);
  const val = res.value;
  if (!val) {
    // Unknown/off-chain: prefer token flow so `ensureTokenRowFromDas` can hydrate.
    return 'mint';
  }
  if (!val.owner.equals(TOKEN_PROGRAM_ID) && !val.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return 'wallet';
  }
  const data = val.data;
  if (typeof data === 'object' && data !== null && 'parsed' in data) {
    const parsed = (data as { parsed?: { type?: string } }).parsed;
    if (parsed?.type === 'mint') {
      return 'mint';
    }
  }
  return 'wallet';
}
