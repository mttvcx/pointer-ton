import type { TokenHolderRow } from '@/lib/db/tokens';

/** One row per wallet — merge token accounts, stable rank order. */
export function dedupeTokenHolderRows(rows: TokenHolderRow[]): TokenHolderRow[] {
  const byWallet = new Map<string, TokenHolderRow>();

  for (const row of rows) {
    const wallet = row.wallet_address?.trim();
    if (!wallet) continue;

    const prev = byWallet.get(wallet);
    if (!prev) {
      byWallet.set(wallet, row);
      continue;
    }

    let amountA = 0n;
    let amountB = 0n;
    try {
      amountA = BigInt(prev.amount_raw);
      amountB = BigInt(row.amount_raw);
    } catch {
      byWallet.set(wallet, prev);
      continue;
    }

    const keep = amountB > amountA ? row : prev;
    const sumRaw = (amountA + amountB).toString();
    const pct =
      (keep.pct_of_supply ?? 0) + (prev === keep ? row.pct_of_supply ?? 0 : prev.pct_of_supply ?? 0);

    byWallet.set(wallet, {
      ...keep,
      amount_raw: sumRaw,
      pct_of_supply: pct > 0 ? Math.min(100, pct) : keep.pct_of_supply,
      is_dev: Boolean(prev.is_dev || row.is_dev),
      is_sniper: Boolean(prev.is_sniper || row.is_sniper),
    });
  }

  const sorted = [...byWallet.values()].sort((a, b) => {
    const pa = a.pct_of_supply ?? 0;
    const pb = b.pct_of_supply ?? 0;
    if (pb !== pa) return pb - pa;
    try {
      const ba = BigInt(a.amount_raw);
      const bb = BigInt(b.amount_raw);
      if (bb !== ba) return bb > ba ? 1 : -1;
    } catch {
      /* fall through */
    }
    return a.wallet_address.localeCompare(b.wallet_address);
  });

  return sorted.map((h, i) => ({ ...h, rank: i + 1 }));
}

/** Sum top-10 holder % from deduped rows, capped at 100. */
export function computeTop10HolderPct(rows: TokenHolderRow[]): number | null {
  const deduped = dedupeTokenHolderRows(rows);
  const top10 = deduped.slice(0, 10).reduce((s, h) => s + (h.pct_of_supply ?? 0), 0);
  if (top10 <= 0) return null;
  return Math.min(100, top10);
}

/** Top-10 % excluding LP / bonding-curve / vault addresses (Axiom-style adjusted). */
export function computeAdjustedTop10HolderPct(
  rows: TokenHolderRow[],
  excludeAddresses: ReadonlySet<string>,
): number | null {
  const deduped = dedupeTokenHolderRows(rows);
  const filtered = deduped.filter((h) => !excludeAddresses.has(h.wallet_address.trim()));
  return computeTop10HolderPct(filtered);
}
