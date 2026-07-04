import type { AppChainId } from '@/lib/chains/appChain';
import { IDENTITY_BATCH_LOOKUP_MAX, IDENTITY_RESOLVE_CACHE_TTL_MS } from '@/lib/identity/config';
import { sourcePublicLabel } from '@/lib/identity/badges';
import {
  normalizeWalletAddress,
  truncateDisplayName,
  walletRegistryKey,
} from '@/lib/identity/normalize';
import {
  getStatsForWallet,
  getWalletEntry,
  importSeedRows,
} from '@/lib/identity/registry';
import type { IdentitySeedRow, ResolvedWalletIdentity } from '@/lib/identity/types';
import { shortenAddress } from '@/lib/utils/addresses';

type CacheEntry = { at: number; value: ResolvedWalletIdentity };

const resolveCache = new Map<string, CacheEntry>();

function cacheGet(key: string): ResolvedWalletIdentity | undefined {
  const row = resolveCache.get(key);
  if (!row) return undefined;
  if (Date.now() - row.at > IDENTITY_RESOLVE_CACHE_TTL_MS) {
    resolveCache.delete(key);
    return undefined;
  }
  return row.value;
}

function cacheSet(key: string, value: ResolvedWalletIdentity): void {
  resolveCache.set(key, { at: Date.now(), value });
}

export type ResolveWalletIdentityParams = {
  chain: AppChainId;
  address: string;
  /** User-created label — always wins. */
  userLabel?: string | null;
};

/**
 * Resolved avatar: prefer a real provided image (CabalSpy supplies these), else
 * derive from the X/Twitter handle via unavatar so labeled wallets without a
 * stored image (e.g. SolScanner KOLs) still show a face. Img onError handles a
 * miss gracefully.
 */
function avatarFor(profile: { avatarUrl: string | null; twitterHandle: string | null }): string | null {
  if (profile.avatarUrl) return profile.avatarUrl;
  const h = profile.twitterHandle?.replace(/^@/, '').trim();
  return h ? `https://unavatar.io/x/${encodeURIComponent(h)}` : null;
}

export function resolveWalletIdentity(
  params: ResolveWalletIdentityParams,
): ResolvedWalletIdentity {
  const { chain, address } = params;
  const userLabel = params.userLabel?.trim() || null;
  const key = walletRegistryKey(chain, address);
  const cached = cacheGet(key);
  if (cached !== undefined && !userLabel) return cached;

  const { normalized } = normalizeWalletAddress(chain, address);
  const shortAddress = shortenAddress(address, 5);
  const entry = getWalletEntry(chain, address);

  if (userLabel) {
    const resolved: ResolvedWalletIdentity = {
      address,
      chain,
      normalizedAddress: normalized,
      shortAddress,
      displayName: truncateDisplayName(userLabel),
      avatarUrl: entry ? avatarFor(entry.profile) : null,
      twitterHandle: entry?.profile.twitterHandle ?? null,
      telegramHandle: entry?.profile.telegramHandle ?? null,
      badges: entry?.profile.badges ?? [],
      primaryCategory: entry?.profile.primaryCategory ?? null,
      source: entry?.wallet.source ?? null,
      sourceUrl: entry?.wallet.sourceUrl ?? null,
      sourceLabel: 'Your label',
      verified: entry?.wallet.verified ?? false,
      manualOverride: true,
      confidence: entry?.wallet.confidence ?? null,
      identityId: entry?.profile.id ?? null,
      stats30d: getStatsForWallet(chain, address, '30d'),
    };
    cacheSet(key, resolved);
    return resolved;
  }

  if (!entry) {
    const fallback: ResolvedWalletIdentity = {
      address,
      chain,
      normalizedAddress: normalized,
      shortAddress,
      displayName: shortAddress,
      avatarUrl: null,
      twitterHandle: null,
      telegramHandle: null,
      badges: [],
      primaryCategory: null,
      source: null,
      sourceUrl: null,
      sourceLabel: 'Wallet address',
      verified: false,
      manualOverride: false,
      confidence: null,
      identityId: null,
      stats30d: null,
    };
    cacheSet(key, fallback);
    return fallback;
  }

  const { profile, wallet } = entry;
  const resolved: ResolvedWalletIdentity = {
    address,
    chain,
    normalizedAddress: normalized,
    shortAddress,
    displayName: truncateDisplayName(profile.displayName),
    avatarUrl: avatarFor(profile),
    twitterHandle: profile.twitterHandle,
    telegramHandle: profile.telegramHandle,
    badges: profile.badges,
    primaryCategory: profile.primaryCategory,
    source: wallet.source,
    sourceUrl: wallet.sourceUrl,
    sourceLabel: profile.verified
      ? 'Pointer verified'
      : sourcePublicLabel(wallet.source),
    verified: profile.verified,
    manualOverride: false,
    confidence: wallet.confidence,
    identityId: profile.id,
    stats30d: getStatsForWallet(chain, address, '30d'),
  };
  cacheSet(key, resolved);
  return resolved;
}

export function resolveWalletIdentities(params: {
  chain: AppChainId;
  addresses: string[];
  userLabels?: Record<string, string | null | undefined>;
}): Record<string, ResolvedWalletIdentity> {
  const uniq = [...new Set(params.addresses.map((a) => a.trim()).filter(Boolean))].slice(
    0,
    IDENTITY_BATCH_LOOKUP_MAX,
  );
  const out: Record<string, ResolvedWalletIdentity> = {};
  for (const addr of uniq) {
    out[addr] = resolveWalletIdentity({
      chain: params.chain,
      address: addr,
      userLabel: params.userLabels?.[addr] ?? null,
    });
  }
  return out;
}

export function importIdentitySeeds(rows: IdentitySeedRow[]): {
  imported: number;
  skipped: number;
} {
  resolveCache.clear();
  return importSeedRows(rows);
}

export { detectDuplicates, listRegistryStats, searchIdentities, searchWallets } from '@/lib/identity/registry';
