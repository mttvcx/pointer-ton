'use client';

import type { ResolvedWalletIdentity } from '@/lib/identity/types';
import type { TvMark } from '@/types/tradingview';

type LiteIdentity = { displayName: string; avatarUrl: string | null; shortAddress: string };

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/**
 * Resolve wallet identities via the SERVER registry (`/api/identity/lookup`).
 * The identity registry (2k+ KOLs w/ twitters) is hydrated server-side only —
 * the client-side `resolveWalletIdentity` map is empty in the browser, so it
 * would fall back to short addresses and never surface KOL names/avatars.
 */
async function fetchIdentities(
  chain: string,
  addresses: string[],
  token: string | null,
): Promise<Map<string, LiteIdentity>> {
  const out = new Map<string, LiteIdentity>();
  if (addresses.length === 0) return out;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/identity/lookup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ chain, addresses: addresses.slice(0, 200) }),
    });
    if (res.ok) {
      const json = (await res.json()) as { identities?: Record<string, ResolvedWalletIdentity> };
      for (const [addr, id] of Object.entries(json.identities ?? {})) {
        out.set(addr, {
          displayName: id.displayName || shortAddr(addr),
          avatarUrl: id.avatarUrl ?? null,
          shortAddress: id.shortAddress || shortAddr(addr),
        });
      }
    }
  } catch {
    // fall back to short addresses below
  }
  return out;
}

/** Bubble categories, mirroring Axiom's Display Options menu (top → bottom). */
export type MarkCategory =
  | 'outliers'
  | 'migration'
  | 'dexPaid'
  | 'myTrades'
  | 'devTrades'
  | 'trackedTrades'
  | 'kolTrades'
  | 'sniperTrades'
  | 'xMentions'
  | 'lobbyTrades'
  | 'alertBubbles'
  | 'feeClaimEvents';

/** `supported` = Pointer has a live data source feeding it today. */
export const MARK_CATEGORIES: { key: MarkCategory; label: string; supported: boolean }[] = [
  { key: 'outliers', label: 'Outliers', supported: false },
  { key: 'migration', label: 'Migration', supported: false },
  { key: 'dexPaid', label: 'DEX Paid', supported: false },
  { key: 'myTrades', label: 'My Trades', supported: false },
  { key: 'devTrades', label: 'Dev Trades', supported: true },
  { key: 'trackedTrades', label: 'Tracked Trades', supported: true },
  { key: 'kolTrades', label: 'KOL Trades', supported: true },
  { key: 'sniperTrades', label: 'Sniper Trades', supported: true },
  { key: 'xMentions', label: 'X Mentions', supported: false },
  { key: 'lobbyTrades', label: 'Lobby Trades', supported: false },
  { key: 'alertBubbles', label: 'Alert Bubbles', supported: false },
  { key: 'feeClaimEvents', label: 'Fee Claim Events', supported: false },
];

/** Default filter state — all on except Outliers (matches Axiom's default). */
export function defaultMarkFilters(): Record<MarkCategory, boolean> {
  const f = {} as Record<MarkCategory, boolean>;
  for (const c of MARK_CATEGORIES) f[c.key] = c.key !== 'outliers';
  return f;
}

/** A chart mark tagged with the category it belongs to (stripped before TV sees it). */
export type PointerMark = TvMark & { category: MarkCategory };

/**
 * Builds the chart's trade bubbles from REAL data:
 * - global on-chain trades (`/chain-trades`, from mint_swaps) → dev + KOL bubbles
 * - the user's tracked-wallet trades (`/wallet-markers`, auth)
 * Wallet identity (KOL name + avatar) is resolved through Pointer's client
 * identity registry — the same one the trades desk uses. Only *notable* trades
 * (dev / labeled-KOL / tracked) become bubbles, so the chart isn't cluttered
 * with anonymous flow — same as Axiom.
 */

type ChainTrade = {
  wallet_address: string;
  side: 'buy' | 'sell';
  tx_signature: string;
  submitted_at: string;
  confirmed_at: string | null;
  desk_badges?: string[];
};

type TrackedMarker = {
  time: number;
  side: 'buy' | 'sell';
  walletAddress: string;
  trackerLabel: string | null;
  txSignature: string;
};

function initials(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export async function buildChartMarks(opts: {
  mint: string;
  creatorWallet: string | null;
  bull: string;
  bear: string;
  authenticated: boolean;
  getToken: () => Promise<string | null>;
  cap?: number;
}): Promise<PointerMark[]> {
  const { mint, creatorWallet, bull, bear, cap = 80 } = opts;
  const creator = creatorWallet?.toLowerCase() ?? null;
  const dark = '#0b0b0d';
  const token = opts.authenticated ? await opts.getToken().catch(() => null) : null;

  const chain: ChainTrade[] = await fetch(`/api/tokens/${encodeURIComponent(mint)}/chain-trades?limit=200`)
    .then((r) => (r.ok ? r.json() : { trades: [] }))
    .then((j) => (Array.isArray(j.trades) ? (j.trades as ChainTrade[]) : []))
    .catch(() => []);

  // The user's tracked wallets (addresses + labels) — so we can bubble ANY of
  // their on-chain trades, not just ones Pointer happened to record. This is the
  // reliable tracked signal (matching by wallet, not tx-signature).
  const trackedByWallet = new Map<string, string | null>();
  let tracked: TrackedMarker[] = [];
  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    const [trackersRes, markersRes] = await Promise.all([
      fetch('/api/trackers', { headers })
        .then((r) => (r.ok ? r.json() : { trackers: [] }))
        .then((j) => (Array.isArray(j.trackers) ? (j.trackers as { walletAddress: string; label: string | null }[]) : []))
        .catch(() => []),
      fetch(`/api/tokens/${encodeURIComponent(mint)}/wallet-markers`, { headers })
        .then((r) => (r.ok ? r.json() : { markers: [] }))
        .then((j) => (Array.isArray(j.markers) ? (j.markers as TrackedMarker[]) : []))
        .catch(() => []),
    ]);
    for (const tk of trackersRes) trackedByWallet.set(tk.walletAddress, tk.label);
    tracked = markersRes;
  }

  // Resolve identities from the SERVER registry (KOL names + avatars + twitters).
  const walletList = [
    ...new Set([
      ...chain.map((t) => t.wallet_address).filter(Boolean),
      ...tracked.map((t) => t.walletAddress),
    ]),
  ];
  const idMap = await fetchIdentities('sol', walletList, token);
  const idOf = (w: string): LiteIdentity =>
    idMap.get(w) ?? { displayName: shortAddr(w), avatarUrl: null, shortAddress: shortAddr(w) };

  const trackedByTx = new Map(tracked.map((t) => [t.txSignature, t]));
  const marks: PointerMark[] = [];
  const seen = new Set<string>();
  const push = (m: PointerMark) => {
    if (marks.length >= cap || seen.has(String(m.id))) return;
    seen.add(String(m.id));
    marks.push(m);
  };

  for (const t of chain) {
    const wallet = t.wallet_address;
    if (!wallet) continue;
    const timeSec = Math.floor(new Date(t.confirmed_at ?? t.submitted_at).getTime() / 1000);
    if (!Number.isFinite(timeSec)) continue;

    const buy = t.side === 'buy';
    const bg = buy ? bull : bear;
    const identity = idOf(wallet);
    const isDev = Boolean(t.desk_badges?.includes('dev')) || (creator != null && wallet.toLowerCase() === creator);
    const isSniper = Boolean(t.desk_badges?.includes('sniper'));
    const hasAvatar = Boolean(identity.avatarUrl);
    const labeled = hasAvatar || identity.displayName !== identity.shortAddress;
    const isTracked = trackedByWallet.has(wallet) || trackedByTx.has(t.tx_signature);
    if (!isDev && !labeled && !isSniper && !isTracked) continue; // notable only

    // Priority: dev > tracked (user explicitly follows) > KOL identity > sniper.
    const trackerLabel = trackedByWallet.get(wallet) ?? trackedByTx.get(t.tx_signature)?.trackerLabel ?? null;
    const name =
      trackerLabel || (labeled ? identity.displayName : null) || (isDev ? 'Dev' : identity.shortAddress);
    const verb = buy ? 'bought' : 'sold';
    const base = {
      id: t.tx_signature,
      time: timeSec,
      color: { border: bg, background: bg },
      text: `${name} ${verb}`,
      labelFontColor: dark,
    };
    const avatarMark = (category: MarkCategory) => ({
      ...base,
      category,
      label: initials(name),
      labelFontColor: '#ffffff',
      minSize: 20,
      borderWidth: 2,
      imageUrl: identity.avatarUrl!,
    });

    if (isDev) {
      push({ ...base, category: 'devTrades', label: buy ? 'DB' : 'DS', minSize: 18 });
    } else if (isTracked) {
      push(hasAvatar ? avatarMark('trackedTrades') : { ...base, category: 'trackedTrades', label: buy ? 'B' : 'S', minSize: 15 });
    } else if (hasAvatar) {
      push(avatarMark('kolTrades'));
    } else if (labeled) {
      push({ ...base, category: 'kolTrades', label: initials(name), minSize: 16 });
    } else if (isSniper) {
      push({ ...base, category: 'sniperTrades', label: 'SN', minSize: 15 });
    }
  }

  // Tracked trades Pointer recorded but the chain feed didn't return.
  for (const t of tracked) {
    if (seen.has(t.txSignature)) continue;
    const buy = t.side === 'buy';
    const bg = buy ? bull : bear;
    const identity = idOf(t.walletAddress);
    const name = t.trackerLabel || identity.displayName;
    push({
      id: t.txSignature,
      time: t.time,
      category: 'trackedTrades',
      color: { border: bg, background: bg },
      text: `${name} ${buy ? 'bought' : 'sold'}`,
      label: identity.avatarUrl ? initials(name) : buy ? 'B' : 'S',
      labelFontColor: identity.avatarUrl ? '#ffffff' : dark,
      minSize: 16,
      ...(identity.avatarUrl ? { imageUrl: identity.avatarUrl, borderWidth: 2 } : {}),
    });
  }

  return marks;
}
