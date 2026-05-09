export interface AppNavItem {
  label: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Explore', href: '/explore' },
  { label: 'Trackers', href: '/trackers' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Wallets', href: '/wallets' },
  { label: 'Points', href: '/points' },
  { label: 'Referral', href: '/referral' },
  {
    label: 'Leaderboard',
    href: '/leaderboard',
  },
];
