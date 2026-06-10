import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { withTimeout } from '@/lib/utils/withTimeout';

/** Dev wallet % of supply when creator is outside the top-N holder list. */
export async function fetchCreatorDevHoldingPct(
  mint: string,
  creatorWallet: string | null | undefined,
): Promise<number | null> {
  const creator = creatorWallet?.trim();
  if (!creator) return null;

  let mintPk: PublicKey;
  let ownerPk: PublicKey;
  try {
    mintPk = new PublicKey(mint.trim());
    ownerPk = new PublicKey(creator);
  } catch {
    return null;
  }

  try {
    const conn = getConnection();
    const [supplyRes, accountsRes] = await Promise.all([
      withTimeout(conn.getTokenSupply(mintPk), 5_000, 'dev_supply'),
      withTimeout(
        conn.getParsedTokenAccountsByOwner(ownerPk, { mint: mintPk }),
        5_000,
        'dev_accounts',
      ),
    ]);

    const supplyRaw = BigInt(supplyRes.value.amount);
    if (supplyRaw <= 0n) return null;

    let held = 0n;
    for (const { account } of accountsRes.value) {
      const info = account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } };
      const raw = info.parsed?.info?.tokenAmount?.amount;
      if (!raw) continue;
      try {
        held += BigInt(raw);
      } catch {
        /* skip malformed */
      }
    }
    if (held <= 0n) return 0;

    const scaled = (held * 10000n) / supplyRaw;
    return Number(scaled) / 100;
  } catch {
    return null;
  }
}
