import 'server-only';
import { Address, TonClient4 } from '@ton/ton';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type TrackedWalletEnrichment = {
  /** Native balance in nanoTON (decimal string from v4 API). */
  nanoTon: string | null;
  lastActiveUnix: number | null;
};

const BATCH = 6;
const MAINNET_RPC = 'https://mainnet-v4.tonhubapi.com';

/** RPC-backed native TON balance per address (best-effort). */
export async function enrichTrackedWalletAddresses(
  addresses: readonly string[],
): Promise<Record<string, TrackedWalletEnrichment>> {
  const out: Record<string, TrackedWalletEnrichment> = {};
  const client = new TonClient4({ endpoint: MAINNET_RPC });
  let seqno: number;
  try {
    const last = await client.getLastBlock();
    seqno = last.last.seqno;
  } catch {
    for (const addr of addresses) {
      out[addr] = { nanoTon: null, lastActiveUnix: null };
    }
    return out;
  }

  for (let i = 0; i < addresses.length; i += BATCH) {
    const slice = addresses.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (addr) => {
        const canonical = normalizeTonAddress(addr);
        if (!canonical) {
          out[addr] = { nanoTon: null, lastActiveUnix: null };
          return;
        }
        try {
          const acc = await client.getAccount(seqno, Address.parse(canonical));
          out[addr] = {
            nanoTon: acc.account.balance.coins,
            lastActiveUnix: null,
          };
        } catch {
          out[addr] = { nanoTon: null, lastActiveUnix: null };
        }
      }),
    );
  }
  return out;
}
