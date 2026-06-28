import type { AppChainId } from '@/lib/chains/appChain';
import { badgesForCategory } from '@/lib/identity/badges';
import { sourcePriority } from '@/lib/identity/config';
import {
  appChainFromSeedChain,
  normalizeDisplayName,
  normalizeTwitterHandle,
  normalizeWalletAddress,
  walletRegistryKey,
} from '@/lib/identity/normalize';
import type {
  IdentityDuplicateFlag,
  IdentityProfile,
  IdentitySeedRow,
  IdentityStatsSnapshot,
  IdentityWallet,
} from '@/lib/identity/types';

import solKolscanSeed from '@/data/identity/solana-kolscan-seed.json';
import ethGmgnSeed from '@/data/identity/eth-gmgn-seed.json';
import baseGmgnSeed from '@/data/identity/base-gmgn-seed.json';
import bnbGmgnSeed from '@/data/identity/bnb-gmgn-seed.json';
import gmgnTrackWallet20Seed from '@/data/identity/gmgn-track-wallet-20-seed.json';
import gmgnTrackEvmWallet20Seed from '@/data/identity/gmgn-track-evm-wallet-20-seed.json';
import axiomKolSolSeed from '@/data/identity/axiom-kol-sol-seed.json';
import cabalspySolSeed from '@/data/identity/cabalspy-sol-seed.json';
import kolscanPartialOverrides from '@/data/identity/kolscan-partial-overrides.json';

type WalletEntry = {
  wallet: IdentityWallet;
  profile: IdentityProfile;
  stats: IdentityStatsSnapshot[];
};

const profilesById = new Map<string, IdentityProfile>();
const walletsByKey = new Map<string, WalletEntry>();
const profilesByNormName = new Map<string, string[]>();
const profilesByTwitter = new Map<string, string[]>();

let bootstrapped = false;
const runtimeRows: IdentitySeedRow[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function mergeBadges(
  category: IdentityProfile['primaryCategory'],
  badges?: IdentitySeedRow['badges'],
): IdentityProfile['badges'] {
  const set = new Set<IdentityProfile['badges'][number]>();
  for (const b of badgesForCategory(category)) set.add(b);
  for (const b of badges ?? []) set.add(b);
  return [...set];
}

function upsertSeedRow(row: IdentitySeedRow, opts?: { allowWeaker?: boolean }): boolean {
  const chain = appChainFromSeedChain(String(row.chain));
  if (!chain) return false;

  const { normalized, valid } = normalizeWalletAddress(chain, row.address);
  if (!valid) return false;

  const key = walletRegistryKey(chain, normalized);
  const existing = walletsByKey.get(key);
  const incomingPriority = sourcePriority(row.source);
  if (
    existing &&
    !opts?.allowWeaker &&
    sourcePriority(existing.wallet.source) > incomingPriority
  ) {
    return false;
  }

  const displayName = row.displayName.trim();
  if (!displayName) return false;

  const profileId = existing?.profile.id ?? newId('id');
  const walletId = existing?.wallet.id ?? newId('wal');
  const ts = nowIso();

  const profile: IdentityProfile = {
    id: profileId,
    displayName,
    normalizedDisplayName: normalizeDisplayName(displayName),
    avatarUrl: row.avatarUrl?.trim() || null,
    twitterHandle: normalizeTwitterHandle(row.twitterHandle),
    telegramHandle: row.telegramHandle?.trim() || null,
    websiteUrl: row.websiteUrl?.trim() || null,
    notes: row.notes?.trim() || null,
    primaryCategory: row.category ?? 'kol',
    badges: mergeBadges(row.category ?? 'kol', row.badges),
    verified: Boolean(row.verified),
    sourcePriority: incomingPriority,
    createdAt: existing?.profile.createdAt ?? ts,
    updatedAt: ts,
  };

  const wallet: IdentityWallet = {
    id: walletId,
    identityId: profileId,
    chain,
    address: row.address.trim(),
    normalizedAddress: normalized,
    addressType: chain === 'sol' ? 'solana' : 'evm',
    label: null,
    source: row.source,
    sourceUrl: row.sourceUrl?.trim() || null,
    confidence: Math.min(1, Math.max(0, row.confidence ?? 0.75)),
    verified: Boolean(row.verified),
    firstSeenAt: existing?.wallet.firstSeenAt ?? ts,
    lastSeenAt: ts,
  };

  const stats: IdentityStatsSnapshot[] = [];
  if (
    row.pnlUsd != null ||
    row.winRate != null ||
    row.txCount != null ||
    row.rank != null
  ) {
    stats.push({
      id: newId('st'),
      identityId: profileId,
      walletId,
      chain,
      period: '30d',
      pnlUsd: row.pnlUsd ?? null,
      pnlPct: row.pnlPct ?? null,
      winRate: row.winRate ?? null,
      txCount: row.txCount ?? null,
      buyCount: row.buyCount ?? null,
      sellCount: row.sellCount ?? null,
      volumeUsd: row.volumeUsd ?? null,
      trackedCount: row.trackedCount ?? null,
      renamedCount: row.renamedCount ?? null,
      rank: row.rank ?? null,
      source: row.source,
      capturedAt: ts,
    });
  }

  profilesById.set(profileId, profile);
  walletsByKey.set(key, {
    wallet,
    profile,
    stats: stats.length > 0 ? stats : (existing?.stats ?? []),
  });

  const norm = profile.normalizedDisplayName;
  const nameBucket = profilesByNormName.get(norm) ?? [];
  if (!nameBucket.includes(profileId)) {
    nameBucket.push(profileId);
    profilesByNormName.set(norm, nameBucket);
  }
  if (profile.twitterHandle) {
    const tw = profilesByTwitter.get(profile.twitterHandle) ?? [];
    if (!tw.includes(profileId)) {
      tw.push(profileId);
      profilesByTwitter.set(profile.twitterHandle, tw);
    }
  }

  return true;
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  const seeds = [
    ...(solKolscanSeed as IdentitySeedRow[]),
    ...(ethGmgnSeed as IdentitySeedRow[]),
    ...(baseGmgnSeed as IdentitySeedRow[]),
    ...(bnbGmgnSeed as IdentitySeedRow[]),
    ...(gmgnTrackWallet20Seed as IdentitySeedRow[]),
    ...(gmgnTrackEvmWallet20Seed as IdentitySeedRow[]),
    ...(axiomKolSolSeed as IdentitySeedRow[]),
    ...(cabalspySolSeed as IdentitySeedRow[]),
    ...runtimeRows,
  ];
  for (const row of seeds) upsertSeedRow(row, { allowWeaker: true });
}

export function importSeedRows(rows: IdentitySeedRow[]): {
  imported: number;
  skipped: number;
} {
  bootstrap();
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    runtimeRows.push(row);
    if (upsertSeedRow(row)) imported += 1;
    else skipped += 1;
  }
  return { imported, skipped };
}

export function getWalletEntry(
  chain: AppChainId,
  address: string,
): WalletEntry | null {
  bootstrap();
  const key = walletRegistryKey(chain, address);
  return walletsByKey.get(key) ?? null;
}

export function getWalletEntryAnyChain(address: string): WalletEntry | null {
  bootstrap();
  const chains: AppChainId[] = ['sol', 'eth', 'bnb', 'base', 'ton'];
  for (const c of chains) {
    const hit = walletsByKey.get(walletRegistryKey(c, address));
    if (hit) return hit;
  }
  return null;
}

export function listSolanaRegistryAddresses(): string[] {
  bootstrap();
  return [...walletsByKey.values()]
    .filter(({ wallet }) => wallet.chain === 'sol')
    .map(({ wallet }) => wallet.address);
}

/** Committed Kolscan/Axiom partial → full overrides for paste import. */
export function getKolscanPartialOverrides(): Record<string, string> {
  return kolscanPartialOverrides as Record<string, string>;
}

export function listRegistryStats(): {
  profileCount: number;
  walletCount: number;
  byChain: Record<string, number>;
  bySource: Record<string, number>;
} {
  bootstrap();
  const byChain: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const { wallet } of walletsByKey.values()) {
    byChain[wallet.chain] = (byChain[wallet.chain] ?? 0) + 1;
    bySource[wallet.source] = (bySource[wallet.source] ?? 0) + 1;
  }
  return {
    profileCount: profilesById.size,
    walletCount: walletsByKey.size,
    byChain,
    bySource,
  };
}

export function searchIdentities(query: string, limit = 25): IdentityProfile[] {
  bootstrap();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: IdentityProfile[] = [];
  for (const p of profilesById.values()) {
    if (
      p.displayName.toLowerCase().includes(q) ||
      p.normalizedDisplayName.includes(q) ||
      (p.twitterHandle?.includes(q.replace('@', '')) ?? false)
    ) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function searchWallets(query: string, limit = 25): IdentityWallet[] {
  bootstrap();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: IdentityWallet[] = [];
  for (const { wallet, profile } of walletsByKey.values()) {
    if (
      wallet.normalizedAddress.includes(q) ||
      wallet.address.toLowerCase().includes(q) ||
      profile.displayName.toLowerCase().includes(q)
    ) {
      out.push(wallet);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function detectDuplicates(): IdentityDuplicateFlag[] {
  bootstrap();
  const flags: IdentityDuplicateFlag[] = [];

  const walletDup = new Map<string, string[]>();
  for (const [key] of walletsByKey) {
    const parts = key.split(':');
    const addr = parts.slice(1).join(':');
    const bucket = walletDup.get(addr) ?? [];
    bucket.push(key);
    walletDup.set(addr, bucket);
  }
  for (const [addr, keys] of walletDup) {
    if (keys.length > 1) {
      flags.push({
        kind: 'wallet',
        message: `Same address on multiple chains: ${addr}`,
        keys,
      });
    }
  }

  for (const [name, ids] of profilesByNormName) {
    if (ids.length > 1) {
      flags.push({
        kind: 'display_name',
        message: `Display name "${name}" maps to ${ids.length} identities`,
        keys: ids,
      });
    }
  }

  for (const [tw, ids] of profilesByTwitter) {
    if (ids.length > 1) {
      flags.push({
        kind: 'twitter',
        message: `@${tw} linked to ${ids.length} identities`,
        keys: ids,
      });
    }
  }

  return flags;
}

export function getStatsForWallet(
  chain: AppChainId,
  address: string,
  period: IdentityStatsSnapshot['period'] = '30d',
): IdentityStatsSnapshot | null {
  const entry = getWalletEntry(chain, address);
  if (!entry) return null;
  return entry.stats.find((s) => s.period === period) ?? entry.stats[0] ?? null;
}
