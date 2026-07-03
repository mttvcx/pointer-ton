import { History, ListChecks, Rss, SlidersHorizontal, TrendingDown } from 'lucide-react';
import type { XMonitorPage } from '@/store/xMonitorPage';

export type XMonitorPageDef = {
  id: Exclude<XMonitorPage, null>;
  label: string;
  icon: typeof Rss;
  title: string;
};

/** Sub-pages of the X Monitor (Feed is the default `null` page, handled separately). */
export const XMONITOR_PAGES: XMonitorPageDef[] = [
  { id: 'sell', label: 'Sells', icon: TrendingDown, title: 'Sell feed' },
  { id: 'history', label: 'History', icon: History, title: 'Token history' },
  { id: 'rules', label: 'Rules', icon: ListChecks, title: 'Automation rules' },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, title: 'X monitor settings' },
];

/** Feed (default) meta for the nav's first button. */
export const XMONITOR_FEED = { label: 'Feed', icon: Rss, title: 'Live feed' } as const;
