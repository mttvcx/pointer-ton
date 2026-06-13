export interface AppNavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Perps', href: '/perps', badge: 'Preview' },
  { label: 'Packs', href: '/packs' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Track', href: '/track' },
  { label: 'Squads', href: '/squads' },
  { label: 'Championship', href: '/championship' },
  { label: '$PTR', href: '/points' },
  { label: 'Predictions', href: '/predictions', badge: 'Preview' },
];

/** Items retained for nav-routing fallback but not shown in the topbar. */
export const HIDDEN_NAV: AppNavItem[] = [];
