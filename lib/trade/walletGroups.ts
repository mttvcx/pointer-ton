/**
 * Wallet groups — user-defined bundles of trading wallets.
 * Persisted in `store/walletGroups`; used by instant trade + portfolio.
 */

export const UNGROUPED_GROUP_ID = '__ungrouped__';

export type StoredWalletGroup = {
  id: string;
  label: string;
  walletAddresses: string[];
  /** Unix ms — drives recency sort in instant-trade strip. */
  lastUsedAt: number;
  createdAt: number;
};

/** Display shape for instant-trade pills (counts resolved against live wallet list). */
export type WalletGroupView = {
  id: string;
  label: string;
  walletCount: number;
  lastUsedAt: number;
};

export function createWalletGroupId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `wg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getRecentGroups(groups: WalletGroupView[], n = 5): WalletGroupView[] {
  return [...groups].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, n);
}

/** Addresses in a group that still exist in the user's wallet list. */
export function resolveGroupAddresses(
  group: Pick<StoredWalletGroup, 'walletAddresses'>,
  knownAddresses: Set<string>,
): string[] {
  return group.walletAddresses.filter((a) => knownAddresses.has(a));
}

export function ungroupedWalletAddresses(
  allAddresses: string[],
  groups: StoredWalletGroup[],
): string[] {
  const assigned = new Set(groups.flatMap((g) => g.walletAddresses));
  return allAddresses.filter((a) => !assigned.has(a));
}

export function groupViewsFromStore(
  groups: StoredWalletGroup[],
  knownAddresses: Set<string>,
  includeUngrouped: boolean,
  ungroupedCount: number,
): WalletGroupView[] {
  const views: WalletGroupView[] = groups.map((g) => ({
    id: g.id,
    label: g.label,
    walletCount: resolveGroupAddresses(g, knownAddresses).length,
    lastUsedAt: g.lastUsedAt,
  }));

  if (includeUngrouped) {
    views.unshift({
      id: UNGROUPED_GROUP_ID,
      label: 'Ungrouped',
      walletCount: ungroupedCount,
      lastUsedAt: Number.MAX_SAFE_INTEGER,
    });
  }

  return views.filter((g) => g.id === UNGROUPED_GROUP_ID || g.walletCount > 0 || groups.some((x) => x.id === g.id));
}

export function addressesForGroupSelection(
  groupId: string,
  groups: StoredWalletGroup[],
  allAddresses: string[],
): string[] {
  if (groupId === UNGROUPED_GROUP_ID) {
    return ungroupedWalletAddresses(allAddresses, groups);
  }
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  const known = new Set(allAddresses);
  return resolveGroupAddresses(group, known);
}
