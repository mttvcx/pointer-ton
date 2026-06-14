import type { IdentitySeedRow } from '@/lib/identity/types';
import {
  extractSolanaAddressesFromText,
  resolvePartialAddress,
} from '@/lib/identity/resolvePartialAddress';
import type { KolLabelImportResult, KolLabelUnresolvedRow } from '@/lib/identity/providers/kolscanParse';

export type AxiomKolParsedRow = {
  displayName: string;
  twitterHandle: string;
  addressPartial: string;
};

const AXIOM_PARTIAL_RE = /^[1-9A-HJ-NP-Za-km-z]{2,8}(\.{3}[1-9A-HJ-NP-Za-km-z]{2,8})?$/;

/**
 * Parse Axiom Trackers → KOLs tab paste:
 * display name, @handle, partial wallet (e.g. BCag...UPJd).
 */
export function parseAxiomKolPaste(text: string): AxiomKolParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim());
  const out: AxiomKolParsedRow[] = [];

  for (let i = 0; i < lines.length; ) {
    const name = lines[i];
    const handleLine = lines[i + 1];
    const addrLine = lines[i + 2];

    if (
      name &&
      handleLine?.startsWith('@') &&
      addrLine &&
      AXIOM_PARTIAL_RE.test(addrLine)
    ) {
      out.push({
        displayName: name,
        twitterHandle: handleLine.replace(/^@/, '').trim(),
        addressPartial: addrLine,
      });
      i += 3;
      while (i < lines.length && lines[i] === '') i += 1;
      continue;
    }

    i += 1;
  }

  return out;
}

export function resolveAxiomKolRows(
  parsed: AxiomKolParsedRow[],
  knownAddresses: string[],
  addressOverrides?: Record<string, string>,
): KolLabelImportResult {
  const pool = [...new Set([...knownAddresses, ...Object.values(addressOverrides ?? {})])];
  const rows: IdentitySeedRow[] = [];
  const unresolved: KolLabelUnresolvedRow[] = [];
  let resolved = 0;

  for (const row of parsed) {
    const override = addressOverrides?.[row.addressPartial];
    let address = override?.trim() || null;
    let matches: string[] = [];

    if (!address) {
      const hit = resolvePartialAddress(row.addressPartial, pool);
      address = hit.address;
      matches = hit.matches;
    }

    if (!address) {
      unresolved.push({
        displayName: row.displayName,
        addressPartial: row.addressPartial,
        twitterHandle: row.twitterHandle,
        reason: matches.length > 1 ? 'ambiguous' : 'no_match',
        matches: matches.length > 1 ? matches : undefined,
      });
      continue;
    }

    rows.push({
      chain: 'solana',
      address,
      displayName: row.displayName,
      twitterHandle: row.twitterHandle,
      category: 'kol',
      badges: ['KOL'],
      source: 'axiom',
      sourceUrl: null,
      confidence: override ? 0.92 : 0.82,
      notes: `axiom_partial:${row.addressPartial}`,
    });
    resolved += 1;
  }

  return { rows, resolved, unresolved };
}

/** Axiom KOL tab paste → labeled seed rows. */
export function importAxiomKolPaste(
  text: string,
  knownAddresses: string[],
  addressOverrides?: Record<string, string>,
): KolLabelImportResult {
  const parsed = parseAxiomKolPaste(text);
  const inlineAddresses = extractSolanaAddressesFromText(text);
  const pool = [...new Set([...knownAddresses, ...inlineAddresses])];
  return resolveAxiomKolRows(parsed, pool, addressOverrides);
}
