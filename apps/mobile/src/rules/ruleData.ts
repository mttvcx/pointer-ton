/**
 * RULE BUILDER DATA + INPUT GUARDRAILS
 *
 * Two concerns live here, kept together because the Alerts rule builder consumes
 * both: (1) demo "selectable" data the picker offers (tracked / popular wallets,
 * recent / popular tokens, popular handles), and (2) the STRICT input validators
 * that gate anything a user types into a rule target.
 *
 * SECURITY NOTE — these validators are the injection guardrails for the rule
 * builder. A rule target is free text the user controls, so it is treated as
 * hostile: every check below is anchored (^…$), length-bounded, and built from a
 * fixed/whitelisted character class so it CANNOT catastrophically backtrack (no
 * nested quantifiers, no overlapping alternations). React Native has no DOM, but
 * we still refuse to store angle brackets, quotes, braces, backticks, or control
 * characters — defense in depth so a hostile string can never round-trip into the
 * backend, a WebView, or a notification payload later.
 */

/** Shape every picker list shares. `sub` is the dim secondary line. */
export type RuleOption = { label: string; value: string; sub?: string };

// ---------------------------------------------------------------------------
// DEMO DATA — selectable in the rule builder (in-memory demo; swap for API).
// All addresses/mints are fake-but-valid-looking base58 (pass isValidMint).
// ---------------------------------------------------------------------------

/** Wallets the user already "tracks". */
export const TRACKED_WALLETS: RuleOption[] = [
  { label: 'Euris', value: '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2', sub: '7Np4…T4K2' },
  { label: 'Cupsey', value: 'CRVidEDtEUTYZisCxBZkpELzhQc9eauMLR3FWg74tReL', sub: 'CRVi…tReL' },
  { label: 'Mr. Frog', value: 'BieeZkdnBAgNYknzo3RH2vku7FcPkFZK5bAQTfafogHX', sub: 'Biee…ogHX' },
  { label: 'Pow', value: '5xLjkQwe7XwXrZcNbVtHmKpGfYuRsTdQaWpLzNmJvHkB', sub: '5xLj…vHkB' },
  { label: 'Loopierr', value: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', sub: '9WzD…AWWM' },
];

/** Well-known-style smart-money wallets to discover. */
export const POPULAR_WALLETS: RuleOption[] = [
  { label: 'Smart Money 01', value: 'Gg9XkM1KhcGtKfT2DzDqZ4o3bxW8jVnHpRsuYaQ4mNvP', sub: 'Gg9X…mNvP' },
  { label: 'Whale Alpha', value: 'HxBpQ7RrLmWnZtVkYaUjDsGfTcXbEhNpQ9o2KdLvMwSr', sub: 'HxBp…MwSr' },
  { label: 'Insider Flow', value: 'J3kLpQwRtUmVnZxYaBcDfGhJkMnPqRsTuVwXyZ12abCd', sub: 'J3kL…abCd' },
  { label: 'Degen King', value: 'KmNpQrStUvWxYz1A2B3C4D5E6F7G8H9JaKbLcMdNeNvP', sub: 'KmNp…NeNvP' },
  { label: 'Sniper Lab', value: '4QwErTyUiOpAsDfGhJkLzXcVbNmQwErTyUiOpAsDfGhJ', sub: '4QwE…DfGhJ' },
];

/** Recently-seen tokens. label = '$SYM', value = mint, sub = name. */
export const RECENT_TOKENS: RuleOption[] = [
  { label: '$piss', value: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', sub: 'Pisscoin' },
  { label: '$WIF', value: 'EKp3pwhPq3kfYZ7Yp8a2sZJp8rR4Vh1nC2dWfGmAbCdX', sub: 'dogwifhat' },
  { label: '$BONK', value: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', sub: 'Bonk' },
  { label: '$MOTHER', value: '3S8qX1MsMqRbswK4dQ5xKzVtR8a9NfJpHwUvZbCmGePq', sub: 'Mother Iggy' },
  { label: '$POPCAT', value: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', sub: 'Popcat' },
  { label: '$GIGA', value: '63LfDmNb7XmRtUvKaWjZqYsCfPgHnTcXbEoNpQ9kLvMz', sub: 'Gigachad' },
];

/** Popular / blue-chip-ish tokens to pick from. */
export const POPULAR_TOKENS: RuleOption[] = [
  { label: '$SOL', value: 'So11111111111111111111111111111111111111112', sub: 'Solana' },
  { label: '$USDC', value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', sub: 'USD Coin' },
  { label: '$JUP', value: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', sub: 'Jupiter' },
  { label: '$PYTH', value: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', sub: 'Pyth Network' },
  { label: '$JTO', value: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', sub: 'Jito' },
  { label: '$RAY', value: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', sub: 'Raydium' },
];

/** Popular X handles. label = '@handle', value = bare handle, sub = descriptor. */
export const POPULAR_HANDLES: RuleOption[] = [
  { label: '@cupseyy', value: 'cupseyy', sub: 'KOL · 120k' },
  { label: '@Euris_eth', value: 'Euris_eth', sub: 'Smart money · 88k' },
  { label: '@mrpunkdoteth', value: 'mrpunkdoteth', sub: 'Trader · 64k' },
  { label: '@blknoiz06', value: 'blknoiz06', sub: 'Ansem · 600k' },
  { label: '@notthreadguy', value: 'notthreadguy', sub: 'Streamer · 210k' },
  { label: '@CryptoKaleo', value: 'CryptoKaleo', sub: 'Analyst · 700k' },
  { label: '@gainzy222', value: 'gainzy222', sub: 'Trader · 150k' },
  { label: '@orangie', value: 'orangie', sub: 'KOL · 95k' },
];

// ---------------------------------------------------------------------------
// VALIDATION / SANITISATION — the injection guardrails (see file header).
// Every pattern is anchored, length-bounded, and single-pass (no backtracking).
// ---------------------------------------------------------------------------

/**
 * Solana base58 address. Anchored ^…$, fixed-length window {32,44}, single
 * non-overlapping character class -> linear scan, cannot backtrack.
 */
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** X/Twitter handle after stripping one leading '@': 1..15 word chars only. */
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

/** Keyword whitelist: letters / numbers / _ , space, $, #, -. 1..40 chars. */
const KEYWORD_RE = /^[\w $#-]{1,40}$/;

/** Matches ASCII control characters (0x00-0x1F) plus DEL (0x7F). */
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x1F\x7F]/g;

/** True for a valid-looking Solana mint/address (base58, 32-44 chars). */
export function isValidMint(s: string): boolean {
  const v = s.trim();
  return MINT_RE.test(v);
}

/** True for a valid X handle (optional single leading '@', then 1-15 word chars). */
export function isValidHandle(s: string): boolean {
  const v = s.trim().replace(/^@/, '');
  return HANDLE_RE.test(v);
}

/** True for a safe keyword (1-40 chars, no angle brackets / quotes / braces / backslashes / controls). */
export function isValidKeyword(s: string): boolean {
  const v = s.trim();
  return KEYWORD_RE.test(v);
}

/**
 * Last-line defense for any free text we store / display: trim, strip ASCII
 * control chars, strip the structural characters < > { } ` , collapse internal
 * whitespace, then hard-cap at 64. Always returns a safe string (never throws).
 */
export function sanitizeText(s: string): string {
  return s
    .trim()
    .replace(CONTROL_RE, '') // strip ASCII control + DEL
    .replace(/[<>{}`]/g, '') // strip structural / template chars
    .replace(/\s+/g, ' ') // collapse runs of whitespace
    .slice(0, 64); // hard length cap
}

/** Normalize a handle for storage / compare: strip one leading '@', trim. */
export function normalizeHandle(s: string): string {
  return s.trim().replace(/^@/, '');
}
