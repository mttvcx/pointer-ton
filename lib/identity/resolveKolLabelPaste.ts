import {
  importAxiomKolPaste,
  parseAxiomKolPaste,
} from '@/lib/identity/providers/axiomKolParse';
import {
  importKolscanLeaderboardPaste,
  parseKolscanLeaderboardPaste,
  type KolLabelImportResult,
} from '@/lib/identity/providers/kolscanParse';
import type { IdentitySeedRow } from '@/lib/identity/types';
import { resolvePartialAddress } from '@/lib/identity/resolvePartialAddress';

export type KolLabelPasteImportResult = KolLabelImportResult & {
  kolscanParsed: number;
  axiomParsed: number;
};

/**
 * Combined paste (Axiom KOL list + Kolscan leaderboard in one blob).
 * Merges by resolved address; Axiom twitter handles win on conflict.
 */
export function importKolLabelPaste(
  text: string,
  knownAddresses: string[],
  addressOverrides?: Record<string, string>,
): KolLabelPasteImportResult {
  const kolscan = importKolscanLeaderboardPaste(text, knownAddresses, addressOverrides);
  const axiom = importAxiomKolPaste(text, knownAddresses, addressOverrides);

  const byAddress = new Map<string, IdentitySeedRow>();
  for (const row of kolscan.rows) {
    byAddress.set(row.address.toLowerCase(), row);
  }
  for (const row of axiom.rows) {
    const key = row.address.toLowerCase();
    const existing = byAddress.get(key);
    if (existing) {
      byAddress.set(key, {
        ...existing,
        twitterHandle: row.twitterHandle ?? existing.twitterHandle,
        displayName: existing.displayName || row.displayName,
        confidence: Math.max(existing.confidence ?? 0, row.confidence ?? 0),
        notes: [existing.notes, row.notes].filter(Boolean).join('; ') || null,
      });
    } else {
      byAddress.set(key, row);
    }
  }

  const unresolved = [...kolscan.unresolved, ...axiom.unresolved].filter((u) => {
    if (u.reason === 'ambiguous') return true;
    const hit = resolvePartialAddress(u.addressPartial, [...byAddress.keys()]);
    return !hit.address;
  });

  const rows = [...byAddress.values()];
  return {
    rows,
    resolved: rows.length,
    unresolved,
    kolscanParsed: parseKolscanLeaderboardPaste(text).length,
    axiomParsed: parseAxiomKolPaste(text).length,
  };
}
