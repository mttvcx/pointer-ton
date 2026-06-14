import 'server-only';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { resolveMintTokenProgram } from '@/lib/solana/tokenProgram';

export type SplTokenBalance = {
  mint: string;
  rawAmount: string;
};

const SPL_TOKEN_PROGRAMS = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID] as const;

async function listNonZeroSplBalancesForProgram(
  walletAddress: string,
  programId: PublicKey,
): Promise<SplTokenBalance[]> {
  const conn = getConnection();
  const owner = new PublicKey(walletAddress);
  const res = await heliusCall('getParsedTokenAccountsByOwner', HELIUS_CREDITS.RPC, () =>
    conn.getParsedTokenAccountsByOwner(owner, { programId }),
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
  return out;
}

/** SPL token accounts (Token + Token-2022) with non-zero balance. */
export async function listNonZeroSplBalances(walletAddress: string): Promise<SplTokenBalance[]> {
  const chunks = await Promise.all(
    SPL_TOKEN_PROGRAMS.map((programId) =>
      listNonZeroSplBalancesForProgram(walletAddress, programId),
    ),
  );
  const byMint = new Map<string, SplTokenBalance>();
  for (const row of chunks.flat()) {
    const prev = byMint.get(row.mint);
    if (!prev || BigInt(row.rawAmount) > BigInt(prev.rawAmount)) {
      byMint.set(row.mint, row);
    }
  }
  const out = [...byMint.values()];
  out.sort((a, b) => {
    const x = BigInt(a.rawAmount);
    const y = BigInt(b.rawAmount);
    if (y > x) return 1;
    if (y < x) return -1;
    return 0;
  });
  return out;
}

/** Raw SPL balance for one mint, or null when no ATA / zero balance. */
export async function getSplBalanceRaw(walletAddress: string, mint: string): Promise<string | null> {
  const rows = await listNonZeroSplBalances(walletAddress);
  const hit = rows.find((r) => r.mint === mint);
  if (hit) return hit.rawAmount;

  const conn = getConnection();
  const mintPk = new PublicKey(mint);
  const ownerPk = new PublicKey(walletAddress);
  const tokenProgram = await resolveMintTokenProgram(mintPk, conn);
  const allowOwnerOffCurve = !PublicKey.isOnCurve(ownerPk.toBytes());
  const ata = getAssociatedTokenAddressSync(
    mintPk,
    ownerPk,
    allowOwnerOffCurve,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const bal = await heliusCall('getTokenAccountBalance', HELIUS_CREDITS.RPC, () =>
    conn.getTokenAccountBalance(ata),
  ).catch(() => null);
  const raw = bal?.value?.amount;
  if (raw == null || raw === '0') return null;
  return raw;
}
