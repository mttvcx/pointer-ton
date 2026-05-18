/**
 * Bottom dock shortcuts (Axiom-style). `wallet` → `/wallets` hub + picker rail;
 * `tracker` toggles the draggable trades-tracker peek on Solana.
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

/** Dock chips that navigate via `<Link>` — `wallet` / `pulse` / `tracker` use bespoke handlers. */
export const DOCK_TRACKER_HREF: Record<
  Exclude<DockTrackerId, 'wallet' | 'pulse' | 'tracker'>,
  string
> = {
  social: '/track',
  discover: '/explore',
  pnl: '/portfolio',
  alpha: '/points',
  squads: '/squads/discover-traders',
};

export const WALLET_HOTKEY_ROUTE = '/wallets';

const FULL: Record<DockTrackerId, string> = {
  wallet: 'Wallet',
  tracker: 'Tracker',
  social: 'Social Tracker',
  discover: 'Discover Tracker',
  pulse: 'Pulse Tracker',
  pnl: 'PnL Tracker',
  alpha: 'Alpha Tracker',
  squads: 'Squads',
};

const COMPACT: Record<DockTrackerId, string> = {
  wallet: 'Wallet',
  tracker: 'Tracker',
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
