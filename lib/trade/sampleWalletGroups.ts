/**
 * Task BB — sample wallet groups for the Instant Trade panel revamp.
 *
 * Real wallet-group persistence + creation flow lands in a follow-up task.
 * These constants drive the top-of-panel switcher (5 most-recently-used pills
 * + overflow chevron) so the visual revamp can ship now.
 */

export interface WalletGroup {
  id: string;
  /** User's name for the group (rendered on the pill). */
  label: string;
  /** How many wallets are in this group. */
  walletCount: number;
  /** Unix ms — used to sort by recency for the inline strip. */
  lastUsedAt: number;
}

export const SAMPLE_WALLET_GROUPS: WalletGroup[] = [
  { id: 'g1', label: '4K MC', walletCount: 3, lastUsedAt: Date.now() - 1000 * 60 * 5 },
  { id: 'g2', label: '8K MC', walletCount: 5, lastUsedAt: Date.now() - 1000 * 60 * 20 },
  { id: 'g3', label: '12K MC', walletCount: 4, lastUsedAt: Date.now() - 1000 * 60 * 60 },
  { id: 'g4', label: '16K MC', walletCount: 2, lastUsedAt: Date.now() - 1000 * 60 * 90 },
  { id: 'g5', label: '20K MC', walletCount: 6, lastUsedAt: Date.now() - 1000 * 60 * 120 },
  { id: 'g6', label: 'Scout', walletCount: 1, lastUsedAt: Date.now() - 1000 * 60 * 240 },
  { id: 'g7', label: 'Heavy', walletCount: 8, lastUsedAt: Date.now() - 1000 * 60 * 480 },
];

/** Top N by recency for the inline strip; the rest fall into the dropdown. */
export function getRecentGroups(groups: WalletGroup[], n = 5): WalletGroup[] {
  return [...groups].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, n);
}
