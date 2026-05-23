import type { PulseTokenBundle } from '@/types/tokens';
import type { TokenRow } from '@/lib/db/tokens';

/** Keep the newest row when the same mint appears more than once in a feed scan. */
export function dedupeTokenRowsByMint(rows: TokenRow[]): TokenRow[] {
  const byMint = new Map<string, TokenRow>();
  for (const row of rows) {
    const prev = byMint.get(row.mint);
    if (!prev || row.created_at.localeCompare(prev.created_at) > 0) {
      byMint.set(row.mint, row);
    }
  }
  return [...byMint.values()];
}

/** Dedupe bundles by mint — prefer row with fresher snapshot or newer token.created_at. */
export function dedupePulseBundlesByMint(bundles: PulseTokenBundle[]): PulseTokenBundle[] {
  const byMint = new Map<string, PulseTokenBundle>();
  for (const bundle of bundles) {
    const prev = byMint.get(bundle.token.mint);
    if (!prev) {
      byMint.set(bundle.token.mint, bundle);
      continue;
    }
    const prevSnap = prev.snapshot?.snapshot_at ?? '';
    const nextSnap = bundle.snapshot?.snapshot_at ?? '';
    if (nextSnap.localeCompare(prevSnap) > 0) {
      byMint.set(bundle.token.mint, bundle);
      continue;
    }
    if (nextSnap === prevSnap && bundle.token.created_at.localeCompare(prev.token.created_at) > 0) {
      byMint.set(bundle.token.mint, bundle);
    }
  }
  return [...byMint.values()];
}
