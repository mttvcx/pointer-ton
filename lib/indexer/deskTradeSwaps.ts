import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { inferSwapEventKind } from '@/lib/indexer/inferSwapEventKind';

/** True when row is a normal buy/sell swap (not liquidity/system). */
export function isDeskTradeSwap(
  row: Pick<
    MintSwapRow,
    'event_kind' | 'source' | 'side' | 'sol_amount' | 'token_amount_ui' | 'pool_address'
  >,
): boolean {
  return inferSwapEventKind(row) === 'swap';
}

/** Keep only buy/sell swaps for desk tape, trades table, and trader metrics. */
export function filterDeskTradeSwaps(rows: MintSwapRow[]): MintSwapRow[] {
  return rows.filter(isDeskTradeSwap);
}

const TRADE_KIND_RANK: Record<string, number> = {
  swap: 3,
  add_liq: 1,
  remove_liq: 0,
};

function pickTradeLeg(legs: MintSwapRow[]): MintSwapRow | null {
  const best = legs.reduce<MintSwapRow | null>((best, row) => {
    if (!isDeskTradeSwap(row)) return best;
    if (!best) return row;
    const rankA = TRADE_KIND_RANK[inferSwapEventKind(best)] ?? 0;
    const rankB = TRADE_KIND_RANK[inferSwapEventKind(row)] ?? 0;
    if (rankB > rankA) return row;
    if (rankB < rankA) return best;
    return row.id > best.id ? row : best;
  }, null);
  return best;
}

/** One row per signature — swaps only, prefer plain swap legs. */
export function dedupeMintSwapsForTradeDesk(rows: MintSwapRow[]): MintSwapRow[] {
  const groups = new Map<string, MintSwapRow[]>();
  for (const row of rows) {
    if (!isDeskTradeSwap(row)) continue;
    const sig = row.signature?.trim();
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(row);
    groups.set(sig, g);
  }

  return [...groups.values()]
    .map(pickTradeLeg)
    .filter((r): r is MintSwapRow => r != null)
    .sort((a, b) => b.block_time.localeCompare(a.block_time));
}
