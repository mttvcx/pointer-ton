import type { TokenRow } from '@/types/tokens';

/** Hiragana/Katakana + CJK unified + compatibility ideographs */
const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3100-\u312f\u31a0-\u31bf]/;

function pulseRowNeedsMandarinAssist(
  name: string | null | undefined,
  symbol: string | null | undefined,
): boolean {
  const n = name ?? '';
  const s = symbol ?? '';
  return CJK_RE.test(n) || CJK_RE.test(s);
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

function pickLatinBlurb(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = stripUrls(raw).replace(/\s+/g, ' ').trim();
  if (!s) return null;

  if (latinLetterRatio(s) >= 0.28 && !CJK_RE.test(s)) return s;

  // Mixed scripts: pull contiguous Latin-ish fragments (meme descriptions often append EN).
  const parts = s.split(/(?=[\u3040-\u30ff\u3400-\u9fff])/);
  const latinChunks = parts
    .map((p) => p.trim())
    .filter((p) => p.length >= 6 && latinLetterRatio(p) >= 0.35 && !CJK_RE.test(p));
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
 * English gloss line under CJK-heavy Pulse identities on BNB (Axiom-style).
 * Uses description / raw_metadata — no live translation API (yet).
 */
export function getPulseBnbGoldSubtitle(token: TokenRow): string | null {
  const name = token.name?.trim() ?? '';
  const symbol = token.symbol?.trim() ?? '';

  if (!pulseRowNeedsMandarinAssist(name || null, symbol || null)) return null;

  const fromDesc = pickLatinBlurb(token.description);
  if (fromDesc) return truncateOneLine(fromDesc, 58);

  const fromMeta = extractEnglishFromUnknown(token.raw_metadata, 0);
  if (fromMeta) return truncateOneLine(fromMeta, 58);

  // Latin ticker gloss when the visible name is CJK-heavy (e.g. duplicated EN headline).
  if (name && CJK_RE.test(name) && /^[A-Za-z][A-Za-z0-9]{1,14}$/.test(symbol)) {
    return truncateOneLine(symbol, 24);
  }

  return null;
}
