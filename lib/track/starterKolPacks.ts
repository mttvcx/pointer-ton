import type { AppChainId } from '@/lib/chains/appChain';
import type { KolHandleRow } from '@/lib/track/kolHandlesLocal';
import type { IdentitySeedRow } from '@/lib/identity/types';

import gmgnTrackWallet20Seed from '@/data/identity/gmgn-track-wallet-20-seed.json';
import gmgnTrackEvmWallet20Seed from '@/data/identity/gmgn-track-evm-wallet-20-seed.json';
import axiomKolSolSeed from '@/data/identity/axiom-kol-sol-seed.json';
import solKolscanSeed from '@/data/identity/solana-kolscan-seed.json';

const SOL_SEEDS = [
  ...(gmgnTrackWallet20Seed as IdentitySeedRow[]),
  ...(axiomKolSolSeed as IdentitySeedRow[]),
  ...(solKolscanSeed as IdentitySeedRow[]),
];

function dedupeSeedRows(rows: IdentitySeedRow[]): IdentitySeedRow[] {
  const byAddress = new Map<string, IdentitySeedRow>();
  for (const row of rows) {
    const key = row.address.trim().toLowerCase();
    if (!key) continue;
    const existing = byAddress.get(key);
    if (!existing) {
      byAddress.set(key, row);
      continue;
    }
    byAddress.set(key, {
      ...existing,
      displayName: existing.displayName || row.displayName,
      twitterHandle: existing.twitterHandle ?? row.twitterHandle,
      rank: existing.rank ?? row.rank,
    });
  }
  return [...byAddress.values()];
}

function uniqueEvmSeedRows(): IdentitySeedRow[] {
  const seen = new Set<string>();
  const out: IdentitySeedRow[] = [];
  for (const row of gmgnTrackEvmWallet20Seed as IdentitySeedRow[]) {
    const key = row.address.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function seedRowToKolHandle(row: IdentitySeedRow): KolHandleRow {
  const handle = row.twitterHandle?.trim();
  return {
    id: `kol-${row.address.slice(0, 12)}`,
    name: row.displayName.trim(),
    handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
    wallet: row.address.trim(),
    followers: row.rank != null ? String(row.rank) : '0',
  };
}

export function chainSupportsStarterKolMint(chain: AppChainId): boolean {
  return chain === 'sol' || chain === 'eth' || chain === 'bnb' || chain === 'base';
}

/** Curated KOL list for opt-in mint — SOL pack vs shared EVM pack (eth/bnb/base). */
export function starterKolEntriesForChain(chain: AppChainId): KolHandleRow[] {
  if (chain === 'sol') {
    return dedupeSeedRows(SOL_SEEDS).map(seedRowToKolHandle);
  }
  if (chain === 'eth' || chain === 'bnb' || chain === 'base') {
    return uniqueEvmSeedRows().map(seedRowToKolHandle);
  }
  return [];
}

export function starterKolPackSlug(chain: AppChainId): string {
  return `starter-kol:${chain}`;
}

export function starterKolGroupLabel(chain: AppChainId): string {
  if (chain === 'sol') return 'Starter KOLs (SOL)';
  if (chain === 'eth') return 'Starter KOLs (ETH)';
  if (chain === 'bnb') return 'Starter KOLs (BNB)';
  if (chain === 'base') return 'Starter KOLs (Base)';
  return 'Starter KOLs';
}
