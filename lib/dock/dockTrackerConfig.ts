/**
 * Bottom dock shortcuts (Axiom-style). `wallet` → `/wallets` hub + picker rail;
 * `social` toggles the draggable wallet-trades peek; `tracker` opens X monitor on Pulse.
 */
export type DockTrackerId =
  | 'wallet'
  | 'tracker'
  | 'social'
  | 'discover'
  | 'pulse'
  | 'pnl'
  | 'alpha'
  | 'squads';

export type DockTrackerMode = 'full' | 'compact' | 'icon';

export const DOCK_TRACKER_IDS: DockTrackerId[] = [
  'wallet',
  'tracker',
  'social',
  'discover',
  'pulse',
  'pnl',
  'alpha',
  'squads',
];

/** Dock chips that navigate via `<Link>` — bespoke handlers for wallet / pulse / tracker / social / squads. */
export const DOCK_TRACKER_HREF: Record<
  Exclude<DockTrackerId, 'wallet' | 'pulse' | 'tracker' | 'social' | 'squads'>,
  string
> = {
  discover: '/explore',
  pnl: '/portfolio',
  alpha: '/points',
};

export const WALLET_HOTKEY_ROUTE = '/wallets';

const FULL: Record<DockTrackerId, string> = {
  wallet: 'Wallet',
  tracker: 'Social Tracker',
  social: 'Wallet Tracker',
  discover: 'Discover Tracker',
  pulse: 'Pulse Tracker',
  pnl: 'PnL Tracker',
  alpha: 'Alpha Tracker',
  squads: 'Squads',
};

const COMPACT: Record<DockTrackerId, string> = {
  wallet: 'Wallet',
  tracker: 'Social',
  social: 'Wallet',
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
