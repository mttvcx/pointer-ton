export interface AppNavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Explore', href: '/explore' },
  { label: 'Perps', href: '/perps', badge: 'Demo' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Track', href: '/track' },
  { label: 'Squads', href: '/squads' },
  { label: 'Points', href: '/points' },
];
