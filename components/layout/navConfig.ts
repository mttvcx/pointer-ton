export interface AppNavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Packs', href: '/packs' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Track', href: '/track' },
  { label: 'Squads', href: '/squads' },
  { label: 'Championship', href: '/championship' },
  { label: '$PTR', href: '/points' },
];

/** Hidden in main nav for founder beta — preserved as Preview surfaces for later phases. */
export const DISABLED_NAV: AppNavItem[] = [
  { label: 'Perps', href: '/perps', disabled: true, badge: 'Preview' },
  { label: 'Predictions', href: '/predictions', disabled: true, badge: 'Preview' },
];
