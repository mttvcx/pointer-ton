import type { TokenRow } from '@/types/tokens';

/**
 * Any non-Latin script we want to surface an English / Latin gloss for —
 * not just CJK. Covers (in range order):
 *   - Greek
 *   - Cyrillic + Cyrillic Supplement
 *   - Hebrew (incl. Alphabetic Presentation Forms)
 *   - Arabic (incl. Supplement, Extended-A, Presentation Forms A/B)
 *   - Devanagari, Bengali, Gurmukhi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Sinhala
 *   - Thai, Lao, Myanmar, Khmer
 *   - Hiragana, Katakana, CJK Unified + Compatibility, Bopomofo, Hangul Jamo + Syllables
 */
const NON_LATIN_RE =
  /[\u0370-\u03ff\u0400-\u052f\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0d80-\u0dff\u0e00-\u0e7f\u0e80-\u0eff\u1000-\u109f\u1100-\u11ff\u1780-\u17ff\u3040-\u30ff\u3100-\u312f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\ufb1d-\ufdff\ufe70-\ufeff\uf900-\ufaff]/;

/**
 * @deprecated kept for any external imports — prefer {@link NON_LATIN_RE}.
 */
const CJK_RE = NON_LATIN_RE;

function pulseRowNeedsTranslationAssist(
  name: string | null | undefined,
  symbol: string | null | undefined,
): boolean {
  const n = name ?? '';
  const s = symbol ?? '';
  return NON_LATIN_RE.test(n) || NON_LATIN_RE.test(s);
}

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}\u2026`;
}

/** Strings that look like taglines rather than hex/data blobs */
function latinLetterRatio(s: string): number {
  const compact = s.replace(/\s/g, '');
  if (!compact.length) return 0;
  const letters = (compact.match(/[A-Za-z]/g) ?? []).length;
  return letters / compact.length;
}

function stripUrls(s: string): string {
  return s.replace(/https?:\/\/[^\s]+/g, ' ');
}

/**
 * Reject blobs that aren't human gloss/translations — especially EVM-ish CAs stuffed
 * into description/metadata (high latinLetterRatio because a–f counts as letters).
 */
function looksLikeBlockchainIdBlob(s: string): boolean {
  const t = s.trim();
  if (!t) return false;

  // Chain-prefixed identifiers: bsc_0x…, eth_0x…, base_…, etc.
  if (/^(?:bsc|bnb|base|eth|ethereum|arb|arbitrum|op|opbnb|polygon|matic|sonic|avax|snow|bnbchain)[_:]/i.test(t))
    return true;
  if (/\b(?:bsc|bnb|base|eth|arb|op|polygon|matic|sonic|sol|ton)_0x/i.test(t)) return true;

  const noEllipsisGap = t.replace(/\s+/g, '').replace(/\.{3,}|…|\u2026/g, '');

  // Long 0x + hex contiguous run (fragment of an address)
  if (/0x[0-9a-f]{18,}/i.test(noEllipsisGap)) return true;

  // Truncated fingerprints still very CA-like
  if (/^0x[0-9a-f]{4,}(\.{3}|…|\u2026)[0-9a-f]{4,}$/i.test(t.replace(/\s/g, ''))) return true;

  // Mostly hex-ish after stripping common separators (full address / hash dumps)
  const hexishBody = noEllipsisGap.replace(/[^0-9a-f]/gi, '');
  if (hexishBody.length >= 24 && hexishBody.length / noEllipsisGap.length >= 0.92) {
    const hasLeading0xPrefix = /^0x/i.test(noEllipsisGap);
    const almostAllHexRemainder =
      /^[0-9a-f]+$/i.test(noEllipsisGap.replace(/^0x/i, ''));
    if (hasLeading0xPrefix && almostAllHexRemainder) return true;
  }

  return false;
}

function pickLatinBlurb(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = stripUrls(raw).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (looksLikeBlockchainIdBlob(s)) return null;

  if (latinLetterRatio(s) >= 0.28 && !NON_LATIN_RE.test(s)) return s;

  /**
   * Mixed scripts: split on every non-Latin codepoint, keep Latin-ish chunks.
   * (Was previously split only on CJK ranges, which missed Hebrew / Arabic / Cyrillic.)
   */
  const parts = s.split(new RegExp(`(?=${NON_LATIN_RE.source})`));
  const latinChunks = parts
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length >= 6 &&
        latinLetterRatio(p) >= 0.35 &&
        !NON_LATIN_RE.test(p) &&
        !looksLikeBlockchainIdBlob(p),
    );
  if (latinChunks.length === 0) return null;
  return latinChunks.sort((a, b) => b.length - a.length)[0] ?? null;
}

const META_ENGLISH_KEYS = [
  'english_name',
  'englishName',
  'en_name',
  'name_en',
  'subtitle',
  'tagline',
  'subtitle_en',
  'description_en',
] as const;

/**
 * Prefer the sibling identity field when one line is non-Latin and the other is Latin-readable
 * — e.g. Hebrew name + `JEWLON` ticker, Chinese name + `POOL` ticker, or vice versa.
 * Runs before description/metadata so we don't surface stray Latin junk from nested JSON.
 */
function latinFromOppositeIdentityField(name: string, symbol: string): string | null {
  const n = name.trim();
  const sy = symbol.trim();

  const nameIsNonLatin = Boolean(n && NON_LATIN_RE.test(n));
  const symIsNonLatin = Boolean(sy && NON_LATIN_RE.test(sy));

  if (nameIsNonLatin && sy.length >= 2) {
    const fromSymbol = pickLatinBlurb(sy);
    if (fromSymbol) return fromSymbol;
  }

  if (symIsNonLatin && n.length >= 2) {
    const fromName = pickLatinBlurb(n);
    if (fromName) return fromName;
  }

  return null;
}

function extractEnglishFromUnknown(meta: unknown, depth: number): string | null {
  if (depth > 5 || meta == null) return null;
  if (typeof meta === 'string') {
    const t = meta.trim();
    if (t.length < 4) return null;
    return pickLatinBlurb(t);
  }
  if (typeof meta !== 'object') return null;
  const o = meta as Record<string, unknown>;

  for (const k of META_ENGLISH_KEYS) {
    const v = o[k];
    if (typeof v === 'string') {
      const hit = pickLatinBlurb(v);
      if (hit) return hit;
    }
  }

  for (const v of Object.values(o)) {
    const hit = extractEnglishFromUnknown(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * English / Latin gloss line under non-Latin Pulse identities (Hebrew, Arabic, CJK,
 * Cyrillic, Devanagari, Thai, Hangul, …). Chain-agnostic.
 *
 * Resolution order:
 *  1. Opposite identity field (name vs symbol — whichever is Latin-readable).
 *  2. `token.description` if it's mostly Latin / has a Latin chunk.
 *  3. `token.raw_metadata` — pulls a Latin blurb from common gloss keys.
 */
export function getPulseGoldSubtitle(token: TokenRow): string | null {
  const name = token.name?.trim() ?? '';
  const symbol = token.symbol?.trim() ?? '';

  if (!pulseRowNeedsTranslationAssist(name || null, symbol || null)) return null;

  const fromOpposite = latinFromOppositeIdentityField(name, symbol);
  if (fromOpposite) return truncateOneLine(fromOpposite, 58);

  const fromDesc = pickLatinBlurb(token.description);
  if (fromDesc) return truncateOneLine(fromDesc, 58);

  const fromMeta = extractEnglishFromUnknown(token.raw_metadata, 0);
  if (fromMeta) return truncateOneLine(fromMeta, 58);

  return null;
}

/** @deprecated kept for back-compat — use {@link getPulseGoldSubtitle}. */
export const getPulseBnbGoldSubtitle = getPulseGoldSubtitle;
