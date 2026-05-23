import 'server-only';

import type { TablesInsert } from '@/lib/supabase/types';
import type { TokenHolderSnapshot } from '@/lib/onchain/solanaTokenHolders';

const BASE = 'https://solana-gateway.moralis.io';

type MoralisTopHolder = {
  ownerAddress?: string;
  owner?: string;
  address?: string;
  balance?: string;
  amount?: string;
  balanceFormatted?: string;
  percentageRelativeToTotalSupply?: number;
  percentage?: number;
};

type MoralisTopHoldersResponse = {
  result?: MoralisTopHolder[];
  totalSupply?: string;
};

type MoralisHolderMetrics = {
  totalHolders?: number;
  holderSupply?: {
    top10?: { supplyPercent?: number };
  };
};

function pickOwner(row: MoralisTopHolder): string | null {
  const v = row.ownerAddress ?? row.owner ?? row.address;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function pickPct(row: MoralisTopHolder): number | null {
  const v = row.percentageRelativeToTotalSupply ?? row.percentage;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pickAmountRaw(row: MoralisTopHolder): string {
  const v = row.balance ?? row.amount ?? row.balanceFormatted;
  if (typeof v === 'string' && v.trim()) return v.replace(/[^\d]/g, '') || '0';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  return '0';
}

/** Moralis Solana top-holders + holder metrics (requires MORALIS_API_KEY). */
export async function fetchMoralisTokenHolderSnapshot(
  mint: string,
  opts?: { creatorWallet?: string | null; limit?: number },
): Promise<TokenHolderSnapshot | null> {
  const key = process.env.MORALIS_API_KEY?.trim();
  if (!key) return null;

  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  const creator = opts?.creatorWallet?.trim() || null;
  const headers = { 'X-Api-Key': key, Accept: 'application/json' };

  const [holdersRes, metricsRes] = await Promise.all([
    fetch(`${BASE}/token/mainnet/${encodeURIComponent(mint)}/top-holders?limit=${limit}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    }),
    fetch(`${BASE}/token/mainnet/holders/${encodeURIComponent(mint)}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    }),
  ]);

  if (!holdersRes.ok) return null;
  const holdersJson = (await holdersRes.json()) as MoralisTopHoldersResponse;
  const metricsJson = metricsRes.ok
    ? ((await metricsRes.json()) as MoralisHolderMetrics)
    : null;

  const now = new Date().toISOString();
  const rows: TablesInsert<'token_holders'>[] = [];
  let devPct: number | null = null;

  for (const item of holdersJson.result ?? []) {
    const owner = pickOwner(item);
    if (!owner) continue;
    const amountRaw = pickAmountRaw(item);
    if (amountRaw === '0') continue;
    const pct = pickPct(item);
    const isDev = Boolean(creator && creator === owner);
    if (isDev && pct != null) devPct = pct;

    rows.push({
      mint,
      wallet_address: owner,
      amount_raw: amountRaw,
      pct_of_supply: pct,
      is_dev: isDev,
      is_sniper: null,
      rank: rows.length + 1,
      computed_at: now,
    });
  }

  const top10FromRows = rows.slice(0, 10).reduce((s, h) => s + (h.pct_of_supply ?? 0), 0);
  const top10Pct =
    metricsJson?.holderSupply?.top10?.supplyPercent ??
    (top10FromRows > 0 ? top10FromRows : null);

  return {
    mint,
    decimals: 9,
    holders: rows,
    holderCount: metricsJson?.totalHolders ?? (rows.length > 0 ? rows.length : null),
    top10HolderPct: top10Pct,
    devHoldingPct: devPct,
    fetchedAt: now,
  };
}
