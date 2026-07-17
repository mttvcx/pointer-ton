'use client';

import { resolveWalletIdentity } from '@/lib/identity/identityService';
import type { TvMark } from '@/types/tradingview';

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
}): Promise<TvMark[]> {
  const { mint, creatorWallet, bull, bear, cap = 80 } = opts;
  const creator = creatorWallet?.toLowerCase() ?? null;
  const dark = '#0b0b0d';

  const chain: ChainTrade[] = await fetch(`/api/tokens/${encodeURIComponent(mint)}/chain-trades?limit=200`)
    .then((r) => (r.ok ? r.json() : { trades: [] }))
    .then((j) => (Array.isArray(j.trades) ? (j.trades as ChainTrade[]) : []))
    .catch(() => []);

  let tracked: TrackedMarker[] = [];
  if (opts.authenticated) {
    const token = await opts.getToken();
    if (token) {
      tracked = await fetch(`/api/tokens/${encodeURIComponent(mint)}/wallet-markers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { markers: [] }))
        .then((j) => (Array.isArray(j.markers) ? (j.markers as TrackedMarker[]) : []))
        .catch(() => []);
    }
  }

  const trackedByTx = new Map(tracked.map((t) => [t.txSignature, t]));
  const marks: TvMark[] = [];
  const seen = new Set<string>();
  const push = (m: TvMark) => {
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
    const identity = resolveWalletIdentity({ chain: 'sol', address: wallet });
    const isDev = Boolean(t.desk_badges?.includes('dev')) || (creator != null && wallet.toLowerCase() === creator);
    const labeled = Boolean(identity.avatarUrl) || identity.displayName !== identity.shortAddress;
    const tracker = trackedByTx.get(t.tx_signature);
    if (!isDev && !labeled && !tracker) continue; // notable only

    const name = tracker?.trackerLabel || (labeled ? identity.displayName : null) || (isDev ? 'Dev' : identity.shortAddress);
    const verb = buy ? 'bought' : 'sold';

    if (isDev) {
      push({
        id: t.tx_signature,
        time: timeSec,
        color: { border: bg, background: bg },
        text: `${name} ${verb}`,
        label: buy ? 'DB' : 'DS',
        labelFontColor: dark,
        minSize: 18,
      });
    } else if (identity.avatarUrl) {
      push({
        id: t.tx_signature,
        time: timeSec,
        color: { border: bg, background: bg },
        text: `${name} ${verb}`,
        label: initials(name),
        labelFontColor: '#ffffff',
        minSize: 20,
        borderWidth: 2,
        imageUrl: identity.avatarUrl,
      });
    } else {
      push({
        id: t.tx_signature,
        time: timeSec,
        color: { border: bg, background: bg },
        text: `${name} ${verb}`,
        label: buy ? 'B' : 'S',
        labelFontColor: dark,
        minSize: 14,
      });
    }
  }

  // Tracked trades not covered by the chain feed.
  for (const t of tracked) {
    if (seen.has(t.txSignature)) continue;
    const buy = t.side === 'buy';
    const bg = buy ? bull : bear;
    const identity = resolveWalletIdentity({ chain: 'sol', address: t.walletAddress });
    const name = t.trackerLabel || identity.displayName;
    push({
      id: t.txSignature,
      time: t.time,
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
