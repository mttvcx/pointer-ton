import 'server-only';

import { KOLSCAN_LEADERBOARD_URL } from '@/lib/identity/config';
import type { IdentitySeedRow } from '@/lib/identity/types';

export {
  parseKolscanExport,
  parseKolscanLeaderboardPaste,
  importKolscanLeaderboardPaste,
} from '@/lib/identity/providers/kolscanParse';

/**
 * Kolscan live import adapter (Stage 3).
 * Do not scrape behind auth at runtime — use paste import or committed seed JSON.
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
      'No public Kolscan API wired. POST /api/identity/import with format=kolscan_paste or kol_label_paste, or commit data/identity/solana-kolscan-seed.json.',
  };
}
