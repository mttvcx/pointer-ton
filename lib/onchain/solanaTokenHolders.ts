import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ParsedAccountData } from '@solana/web3.js';
import { getConnection, getPublicSolanaConnection, isRpcQuotaError } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { withTimeout } from '@/lib/utils/withTimeout';
import type { TablesInsert } from '@/lib/supabase/types';

export type TokenHolderSnapshot = {
  mint: string;
  decimals: number;
  holders: TablesInsert<'token_holders'>[];
  holderCountTotal: number | null;
  top10HolderPct: number | null;
  devHoldingPct: number | null;
  fetchedAt: string;
};

function pctOfSupply(amountRaw: bigint, supplyRaw: bigint): number | null {
  if (supplyRaw <= 0n) return null;
  const scaled = (amountRaw * 10000n) / supplyRaw;
  return Number(scaled) / 100;
}

async function countNonZeroHolders(mint: PublicKey): Promise<number | null> {
  if (process.env.POINTER_HOLDER_GPA !== '1') return null;
  const conn = getConnection();
  try {
    const accounts = await withTimeout(
      heliusCall('getProgramAccounts', HELIUS_CREDITS.RPC * 40, () =>
        conn.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 0, bytes: mint.toBase58() } },
          ],
        }),
      ),
      6_000,
      'holder_count_gpa',
    );
    let n = 0;
    for (const { account } of accounts) {
      const data = account.data as ParsedAccountData;
      const ui = data.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof ui === 'number' && ui > 0) n += 1;
    }
    return n;
  } catch {
    return null;
  }
}

async function withRpcFallback<T>(
  label: string,
  fn: (conn: ReturnType<typeof getConnection>) => Promise<T>,
): Promise<T> {
  const endpoints: Array<() => ReturnType<typeof getConnection>> = [
    getConnection,
    getPublicSolanaConnection,
  ];
  let lastErr: unknown;
  for (let i = 0; i < endpoints.length; i += 1) {
    try {
      const conn = endpoints[i]!();
      if (i === 0) {
        return await heliusCall(label, HELIUS_CREDITS.RPC, () => fn(conn));
      }
      return await fn(conn);
    } catch (err) {
      lastErr = err;
      if (i === 0 && !isRpcQuotaError(err)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('rpc_unavailable');
}

/**
 * Live Solana holder desk — top wallets via `getTokenLargestAccounts` + owner resolution.
 * Holder count uses optional `getProgramAccounts` scan when `POINTER_HOLDER_GPA=1`.
 */
export async function fetchSolanaTokenHolderSnapshot(
  mint: string,
  opts?: { creatorWallet?: string | null; limit?: number },
): Promise<TokenHolderSnapshot | null> {
  let mintPk: PublicKey;
  try {
    mintPk = new PublicKey(mint.trim());
  } catch {
    return null;
  }

  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 20);  const creator = opts?.creatorWallet?.trim() || null;

  const [supplyRes, largestRes] = await Promise.all([
    withRpcFallback('getTokenSupply', (c) => c.getTokenSupply(mintPk)),
    withRpcFallback('getTokenLargestAccounts', (c) => c.getTokenLargestAccounts(mintPk)),
  ]);

  const decimals = supplyRes.value.decimals;
  const supplyRaw = BigInt(supplyRes.value.amount);
  const largest = largestRes.value.slice(0, limit);
  if (largest.length === 0) {
    return {
      mint: mintPk.toBase58(),
      decimals,
      holders: [],
      holderCountTotal: 0,
      top10HolderPct: null,
      devHoldingPct: null,
      fetchedAt: new Date().toISOString(),
    };
  }

  const tokenAccounts = largest.map((row) => row.address);
  const parsed = await withRpcFallback('getMultipleParsedAccounts', (c) =>
    c.getMultipleParsedAccounts(tokenAccounts),
  );

  /** Aggregate multiple token accounts per owner (prevents duplicate holder rows). */
  const byOwner = new Map<string, bigint>();

  for (let i = 0; i < largest.length; i += 1) {
    const acctInfo = parsed.value[i];
    const data = acctInfo?.data as ParsedAccountData | undefined;
    const info = data?.parsed?.info as
      | { owner?: string; tokenAmount?: { amount?: string } }
      | undefined;
    const owner = info?.owner?.trim();
    const amountRawStr = info?.tokenAmount?.amount ?? largest[i]!.amount;
    if (!owner) continue;

    let amountRaw = 0n;
    try {
      amountRaw = BigInt(amountRawStr);
    } catch {
      continue;
    }
    if (amountRaw <= 0n) continue;
    byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amountRaw);
  }

  const sortedOwners = [...byOwner.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] > a[1] ? 1 : -1;
    return a[0].localeCompare(b[0]);
  });

  const rows: TablesInsert<'token_holders'>[] = [];
  let devPct: number | null = null;
  const now = new Date().toISOString();

  for (let i = 0; i < sortedOwners.length && i < limit; i += 1) {
    const [owner, amountRaw] = sortedOwners[i]!;
    const pct = pctOfSupply(amountRaw, supplyRaw);
    const isDev = Boolean(creator && creator === owner);
    if (isDev && pct != null) devPct = pct;

    rows.push({
      mint: mintPk.toBase58(),
      wallet_address: owner,
      amount_raw: amountRaw.toString(),
      pct_of_supply: pct,
      is_dev: isDev,
      is_sniper: null,
      rank: i + 1,
      computed_at: now,
    });
  }

  const top10 = rows.slice(0, 10).reduce((sum, h) => sum + (h.pct_of_supply ?? 0), 0);
  const holderCountTotal = await countNonZeroHolders(mintPk);

  return {
    mint: mintPk.toBase58(),
    decimals,
    holders: rows,
    holderCountTotal,
    top10HolderPct: top10 > 0 ? top10 : null,
    devHoldingPct: devPct,
    fetchedAt: new Date().toISOString(),
  };
}
