import 'server-only';

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';

export type SplTokenBalance = {
  mint: string;
  rawAmount: string;
};

/** SPL token accounts (Token program) with non-zero balance. */
export async function listNonZeroSplBalances(walletAddress: string): Promise<SplTokenBalance[]> {
  const conn = getConnection();
  const owner = new PublicKey(walletAddress);
  const res = await heliusCall('getParsedTokenAccountsByOwner', HELIUS_CREDITS.RPC, () =>
    conn.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  const out: SplTokenBalance[] = [];
  for (const { account } of res.value) {
    const parsed = account.data as unknown as {
      parsed?: { type?: string; info?: { mint?: string; tokenAmount?: { amount?: string } } };
    };
    const info = parsed.parsed?.info;
    const mint = info?.mint;
    const amount = info?.tokenAmount?.amount;
    if (mint && amount != null && amount !== '0') {
      out.push({ mint, rawAmount: amount });
    }
  }
  out.sort((a, b) => {
    const x = BigInt(a.rawAmount);
    const y = BigInt(b.rawAmount);
    if (y > x) return 1;
    if (y < x) return -1;
    return 0;
  });
  return out;
}
