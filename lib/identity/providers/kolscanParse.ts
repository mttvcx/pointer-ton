import { KOLSCAN_LEADERBOARD_URL } from '@/lib/identity/config';
import {
  extractSolanaAddressesFromText,
  matchesPartialAddress,
  resolvePartialAddress,
} from '@/lib/identity/resolvePartialAddress';
import type { IdentitySeedRow } from '@/lib/identity/types';

export type KolscanLeaderboardParsedRow = {
  rank: number;
  displayName: string;
  addressPartial: string;
  buyCount?: number;
  sellCount?: number;
  pnlSol?: number;
  pnlUsd?: number;
  hasTwitter?: boolean;
  hasTelegram?: boolean;
};

export type KolLabelUnresolvedRow = {
  displayName: string;
  addressPartial: string;
  twitterHandle?: string | null;
  reason: 'no_match' | 'ambiguous' | 'invalid_address';
  matches?: string[];
};

export type KolLabelImportResult = {
  rows: IdentitySeedRow[];
  resolved: number;
  unresolved: KolLabelUnresolvedRow[];
};

const KOLSCAN_NOISE = new Set([
  'pfp',
  'twitter logo',
  'telegram logo',
  'twitter logotelegram logo',
  'trophy',
  'KOL Leaderboard',
  'Daily',
  'Weekly',
  'Monthly',
]);

const PARTIAL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{4,8}$/;
const PARTIAL_ELLIPSIS_RE = /^[1-9A-HJ-NP-Za-km-z]{2,8}\.{3}[1-9A-HJ-NP-Za-km-z]{2,8}$/;

function parseNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
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
      avatarUrl:
        typeof r.avatar === 'string'
          ? r.avatar
          : typeof r.avatarUrl === 'string'
            ? r.avatarUrl
            : null,
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

/**
 * Parse pasted Kolscan leaderboard text (Daily / Weekly / Monthly export or page copy).
 * Handles rank blocks with wins/losses and PnL lines.
 */
export function parseKolscanLeaderboardPaste(text: string): KolscanLeaderboardParsedRow[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const out: KolscanLeaderboardParsedRow[] = [];

  const blockRe =
    /(?:^|\n)(\d{1,4})\s*\n(?:pfp\s*\n)?([^\n]+?)\s*\n(?:(?:twitter[^\n]*\n|telegram[^\n]*\n)*)?(?:twitter logo(?:\s*\n(?:telegram logo|twitter logotelegram logo)?)?\s*\n)?([1-9A-HJ-NP-Za-km-z]{4,8})\s*\n[\s\S]*?(\d+)\s*\n\s*\/\s*\n\s*(\d+)\s*\n\s*([+-][\d,]+\.?\d*)\s*Sol\s*\(\$([\d,]+\.?\d*)\)/g;

  for (const m of normalized.matchAll(blockRe)) {
    const displayName = m[2]!.trim();
    if (KOLSCAN_NOISE.has(displayName)) continue;
    out.push({
      rank: Number(m[1]),
      displayName,
      addressPartial: m[3]!.trim(),
      buyCount: parseNumber(m[4]!),
      sellCount: parseNumber(m[5]!),
      pnlSol: parseNumber(m[6]!),
      pnlUsd: parseNumber(m[7]!),
      hasTwitter: /twitter/i.test(m[0]!),
      hasTelegram: /telegram/i.test(m[0]!),
    });
  }

  if (out.length > 0) return out;

  // Compact markdown-style blocks from kolscan.io page copy (# Name, partial, stats).
  const compactRe =
    /#\s*([^\n#]+?)\s*\n\s*([1-9A-HJ-NP-Za-km-z]{4,8})\s*\n\s*(\d+)\s*\n\s*\/\s*\n\s*(\d+)\s*\n\s*#\s*([+-][\d,]+\.?\d*)\s*Sol\s*\n\s*#\s*\(\$([\d,]+\.?\d*)\)/g;
  let rank = 0;
  for (const m of normalized.matchAll(compactRe)) {
    rank += 1;
    out.push({
      rank,
      displayName: m[1]!.trim(),
      addressPartial: m[2]!.trim(),
      buyCount: parseNumber(m[3]!),
      sellCount: parseNumber(m[4]!),
      pnlSol: parseNumber(m[5]!),
      pnlUsd: parseNumber(m[6]!),
    });
  }

  return out;
}

export function resolveKolscanLeaderboardRows(
  parsed: KolscanLeaderboardParsedRow[],
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
        reason: matches.length > 1 ? 'ambiguous' : 'no_match',
        matches: matches.length > 1 ? matches : undefined,
      });
      continue;
    }

    const wins = row.buyCount ?? 0;
    const losses = row.sellCount ?? 0;
    const total = wins + losses;
    const winRate = total > 0 ? wins / total : null;

    rows.push({
      chain: 'solana',
      address,
      displayName: row.displayName,
      twitterHandle: null,
      telegramHandle: row.hasTelegram ? null : null,
      category: 'kol',
      badges: ['KOL'],
      source: 'kolscan',
      sourceUrl: KOLSCAN_LEADERBOARD_URL,
      confidence: override ? 0.92 : matchesPartialAddress(address, row.addressPartial) ? 0.85 : 0.75,
      rank: row.rank,
      pnlUsd: row.pnlUsd ?? null,
      buyCount: row.buyCount ?? null,
      sellCount: row.sellCount ?? null,
      winRate,
      txCount: total > 0 ? total : null,
      notes: `kolscan_partial:${row.addressPartial}`,
    });
    resolved += 1;
  }

  return { rows, resolved, unresolved };
}

/** Full Kolscan paste pipeline: parse + resolve partials + inline full addresses. */
export function importKolscanLeaderboardPaste(
  text: string,
  knownAddresses: string[],
  addressOverrides?: Record<string, string>,
): KolLabelImportResult {
  const parsed = parseKolscanLeaderboardPaste(text);
  const inlineAddresses = extractSolanaAddressesFromText(text);
  const pool = [...new Set([...knownAddresses, ...inlineAddresses])];
  return resolveKolscanLeaderboardRows(parsed, pool, addressOverrides);
}

export function isPartialAddressToken(line: string): boolean {
  const t = line.trim();
  return PARTIAL_ADDR_RE.test(t) || PARTIAL_ELLIPSIS_RE.test(t);
}
