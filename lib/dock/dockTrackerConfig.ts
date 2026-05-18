/**
 * Bottom “tracker” shortcuts (Axiom-style dock). `wallet` maps to `/wallets` for
 * hotkey navigation — the picker still opens from the chip in the bottom bar.
 */
export type DockTrackerId =
  | 'wallet'
  | 'social'
  | 'discover'
  | 'pulse'
  | 'pnl'
  | 'alpha'
  | 'squads';

export type DockTrackerMode = 'full' | 'compact' | 'icon';

export const DOCK_TRACKER_IDS: DockTrackerId[] = [
  'wallet',
  'social',
  'discover',
  'pulse',
  'pnl',
  'alpha',
  'squads',
];

/** Next.js routes for keyboard shortcuts (wallet → manage wallets page). */
export const DOCK_TRACKER_HREF: Record<Exclude<DockTrackerId, 'wallet'>, string> = {
  social: '/track',
  discover: '/explore',
  pulse: '/pulse',
  pnl: '/portfolio',
  alpha: '/points',
  squads: '/squads/discover-traders',
};

export const WALLET_HOTKEY_ROUTE = '/wallets';

const FULL: Record<DockTrackerId, string> = {
  wallet: 'Wallet Tracker',
  social: 'Social Tracker',
  discover: 'Discover Tracker',
  pulse: 'Pulse Tracker',
  pnl: 'PnL Tracker',
  alpha: 'Alpha Tracker',
  squads: 'Squads',
};

const COMPACT: Record<DockTrackerId, string> = {
  wallet: 'Wallet',
  social: 'Social',
  discover: 'Discover',
  pulse: 'Pulse',
  pnl: 'PnL',
  alpha: 'Alpha',
  squads: 'Squads',
};

export function dockTrackerLabel(id: DockTrackerId, mode: DockTrackerMode): string {
  if (mode === 'full') return FULL[id];
  if (mode === 'compact') return COMPACT[id];
  return '';
}
