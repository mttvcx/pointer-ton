/**
 * Deterministic entity detection — finds Solana token mints / contract addresses,
 * wallets, EVM addresses and X handles in text. NO network, NO AI: this runs on
 * the hot path (every DOM scan) so it must be cheap and exact. AI only ever
 * *summarizes* what this verifies.
 */

// 'unknown' = an ambiguous Solana address (could be a mint or a wallet). We never
// guess from length — the hover resolves it against the backend (a token has a
// market; a wallet doesn't).
export type EntityKind = 'token' | 'wallet' | 'evm' | 'unknown' | 'handle';

export interface DetectedEntity {
  kind: EntityKind;
  /** Canonical value: base58 mint/wallet, 0x-address (lowercased), or handle (no @). */
  value: string;
  /** The raw matched substring (for highlighting). */
  raw: string;
}

// Base58 (no 0, O, I, l). Solana addresses are 32–44 chars.
const BASE58 = '[1-9A-HJ-NP-Za-km-z]';
const SOL_ADDRESS_RE = new RegExp(`\\b${BASE58}{32,44}\\b`, 'g');
const EVM_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const X_HANDLE_RE = /(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{1,15})\b/g;

// launchpad mint suffixes — a strong, RELIABLE token signal (length is NOT).
const MINT_SUFFIX_RE = /(pump|bonk|moon|fun)$/i;
// Words near an address that reveal whether it's a wallet or a contract.
const WALLET_CTX_RE = /\b(wallet|wallets|holder|holders|deployer|dev|sender|recipient|owner|account|address)\b/i;
const TOKEN_CTX_RE = /\b(ca|contract|token|mint|coin|ticker|chart)\b|\$[A-Za-z]/i;

/** Reject obvious base58 false-positives (tx signatures are 64–88 chars; we bound at 44). */
function isPlausibleSolAddress(addr: string): boolean {
  return addr.length >= 32 && addr.length <= 44;
}

/** Classify an ambiguous Solana address using the ~42 chars of text before it. */
function classifySol(raw: string, before: string, hint?: 'token' | 'wallet'): EntityKind {
  if (MINT_SUFFIX_RE.test(raw)) return 'token';
  if (hint) return hint;
  const ctx = before.slice(-42);
  if (WALLET_CTX_RE.test(ctx)) return 'wallet';
  if (TOKEN_CTX_RE.test(ctx)) return 'token';
  return 'unknown'; // resolve on hover
}

/**
 * Extract entities from a string. `hint` lets a site adapter bias ambiguous
 * base58 toward token vs wallet (e.g. a token page is token-context).
 */
export function detectInText(
  text: string,
  hint?: 'token' | 'wallet',
): DetectedEntity[] {
  if (!text || text.length < 3) return [];
  const out: DetectedEntity[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(EVM_ADDRESS_RE)) {
    const value = m[0].toLowerCase();
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ kind: 'evm', value, raw: m[0] });
  }

  for (const m of text.matchAll(SOL_ADDRESS_RE)) {
    const raw = m[0];
    if (!isPlausibleSolAddress(raw) || seen.has(raw)) continue;
    seen.add(raw);
    const before = text.slice(0, m.index ?? 0);
    out.push({ kind: classifySol(raw, before, hint), value: raw, raw });
  }

  for (const m of text.matchAll(X_HANDLE_RE)) {
    const handle = m[1]?.toLowerCase();
    if (!handle || seen.has(`@${handle}`)) continue;
    seen.add(`@${handle}`);
    out.push({ kind: 'handle', value: handle, raw: `@${m[1]}` });
  }

  return out;
}

/** True when a string is a single, clean address (e.g. a copied CA in an input). */
export function classifyExact(value: string): DetectedEntity | null {
  const v = value.trim();
  if (EVM_ADDRESS_RE.test(v) && v.length === 42) {
    EVM_ADDRESS_RE.lastIndex = 0;
    return { kind: 'evm', value: v.toLowerCase(), raw: v };
  }
  EVM_ADDRESS_RE.lastIndex = 0;
  if (isPlausibleSolAddress(v) && new RegExp(`^${BASE58}{32,44}$`).test(v)) {
    return { kind: MINT_SUFFIX_RE.test(v) ? 'token' : 'unknown', value: v, raw: v };
  }
  const h = v.replace(/^@/, '');
  if (/^[A-Za-z0-9_]{1,15}$/.test(h) && v.startsWith('@')) {
    return { kind: 'handle', value: h.toLowerCase(), raw: v };
  }
  return null;
}
