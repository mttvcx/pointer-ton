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
