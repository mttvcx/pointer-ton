import 'server-only';

import type { IdentitySeedRow } from '@/lib/identity/types';
import { KOLSCAN_LEADERBOARD_URL } from '@/lib/identity/config';

/**
 * Kolscan live import adapter (Stage 3).
 * Do not scrape behind auth at runtime — use {@link parseKolscanExport} or committed seed JSON.
 */
export type KolscanImportResult = {
  rows: IdentitySeedRow[];
  sourceUrl: string;
  note: string;
};

export async function fetchKolscanLeaderboard(): Promise<KolscanImportResult> {
  return {
    rows: [],
    sourceUrl: KOLSCAN_LEADERBOARD_URL,
    note:
      'No public Kolscan API wired. Export leaderboard to JSON and POST /api/identity/import, or commit data/identity/solana-kolscan-seed.json.',
  };
}

/** Accept pre-exported JSON from Kolscan-style tools. */
export function parseKolscanExport(raw: unknown): IdentitySeedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: IdentitySeedRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const address = String(r.wallet ?? r.address ?? '').trim();
    const displayName = String(r.name ?? r.displayName ?? '').trim();
    if (!address || !displayName) continue;
    out.push({
      chain: 'solana',
      address,
      displayName,
      avatarUrl: typeof r.avatar === 'string' ? r.avatar : typeof r.avatarUrl === 'string' ? r.avatarUrl : null,
      twitterHandle: typeof r.twitter === 'string' ? r.twitter : null,
      telegramHandle: typeof r.telegram === 'string' ? r.telegram : null,
      category: 'kol',
      badges: ['KOL'],
      source: 'kolscan',
      sourceUrl: KOLSCAN_LEADERBOARD_URL,
      confidence: 0.8,
      rank: typeof r.rank === 'number' ? r.rank : null,
      pnlUsd: typeof r.pnlUsd === 'number' ? r.pnlUsd : null,
    });
  }
  return out;
}
