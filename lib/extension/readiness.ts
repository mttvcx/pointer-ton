/**
 * Pointer Extension readiness tracker — pure data + rollup (no I/O, unit-testable).
 * The extension build hasn't started; this is the status board that gates it. Each
 * item's `status` reflects current truth and is updated as work lands. Surfaced at
 * /admin/extension.
 */

export type ReadinessStatus = 'done' | 'in_progress' | 'blocked' | 'todo';

export type ReadinessItem = {
  key: string;
  label: string;
  category: 'injection' | 'chrome' | 'auth' | 'release';
  status: ReadinessStatus;
  note?: string;
};

export const EXTENSION_READINESS: readonly ReadinessItem[] = [
  // Injection surfaces (content scripts overlaying these sites).
  { key: 'twitter', label: 'Twitter / X injection', category: 'injection', status: 'todo', note: 'Overlay token CAs + risk reads on tweets.' },
  { key: 'dexscreener', label: 'DexScreener', category: 'injection', status: 'todo' },
  { key: 'gmgn', label: 'GMGN', category: 'injection', status: 'todo' },
  { key: 'photon', label: 'Photon', category: 'injection', status: 'todo' },
  { key: 'bullx', label: 'BullX', category: 'injection', status: 'todo' },
  { key: 'axiom', label: 'Axiom', category: 'injection', status: 'todo' },
  // Chrome platform.
  { key: 'permissions', label: 'Chrome permissions (minimal scope)', category: 'chrome', status: 'todo' },
  { key: 'manifest', label: 'Manifest v3', category: 'chrome', status: 'todo' },
  { key: 'build', label: 'Extension build pipeline', category: 'chrome', status: 'todo' },
  { key: 'store', label: 'Chrome Web Store listing', category: 'release', status: 'todo' },
  // Auth / session bridge (the hard part — must reuse Pointer's hardened API).
  { key: 'oauth', label: 'OAuth / sign-in handoff', category: 'auth', status: 'blocked', note: 'Needs Pointer auth-handoff + CORS hardening (extension audit blockers).' },
  { key: 'session_sync', label: 'Session sync (web ↔ extension)', category: 'auth', status: 'blocked' },
  { key: 'wallet_sync', label: 'Wallet sync', category: 'auth', status: 'blocked' },
  { key: 'revocation', label: 'Token revocation + rate limiting for extension', category: 'auth', status: 'blocked', note: 'Per the extension readiness audit (CORS/auth-handoff/revocation/rate-limit blockers).' },
  // Release.
  { key: 'version', label: 'Versioning', category: 'release', status: 'todo' },
  { key: 'release_notes', label: 'Release notes', category: 'release', status: 'todo' },
] as const;

export type ReadinessSummary = {
  total: number;
  done: number;
  in_progress: number;
  blocked: number;
  todo: number;
  /** % done, 0–100. */
  percent: number;
  /** True only when every item is done — the gate to start extension work. */
  ready: boolean;
};

export function summarizeReadiness(items: readonly ReadinessItem[] = EXTENSION_READINESS): ReadinessSummary {
  const count = (s: ReadinessStatus) => items.filter((i) => i.status === s).length;
  const done = count('done');
  const total = items.length;
  return {
    total,
    done,
    in_progress: count('in_progress'),
    blocked: count('blocked'),
    todo: count('todo'),
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    ready: total > 0 && done === total,
  };
}
