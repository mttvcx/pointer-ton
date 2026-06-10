import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { inferSwapEventKind } from '@/lib/indexer/inferSwapEventKind';

const KIND_RANK: Record<string, number> = {
  remove_liq: 3,
  add_liq: 2,
  swap: 1,
};

function pickBestLeg(legs: MintSwapRow[]): MintSwapRow {
  return legs.reduce((best, row) => {
    const rankA = KIND_RANK[inferSwapEventKind(best)] ?? 0;
    const rankB = KIND_RANK[inferSwapEventKind(row)] ?? 0;
    if (rankB > rankA) return row;
    if (rankB < rankA) return best;
    return row.id > best.id ? row : best;
  });
}

/** One desk tape row per signature — prefer liquidity events over plain swaps. */
export function dedupeMintSwapsForDesk(rows: MintSwapRow[]): MintSwapRow[] {
  const groups = new Map<string, MintSwapRow[]>();
  for (const row of rows) {
    const sig = row.signature?.trim();
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(row);
    groups.set(sig, g);
  }

  return [...groups.values()]
    .map(pickBestLeg)
    .sort((a, b) => b.block_time.localeCompare(a.block_time));
}
