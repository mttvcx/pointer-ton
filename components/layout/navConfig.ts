export interface AppNavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Perps', href: '/perps' },
  { label: 'Packs', href: '/packs' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Track', href: '/track' },
  { label: 'Squads', href: '/squads' },
  { label: 'Championship', href: '/championship' },
  { label: '$PTR', href: '/points' },
];

/**
 * Items retained for nav-routing fallback but not shown in the topbar.
 * Predictions is hidden until Kalshi (US-only) is wired post-launch — the full
 * build lives on the `predictions-market` branch; the route 404s on main.
 */
export const HIDDEN_NAV: AppNavItem[] = [];
