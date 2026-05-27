'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AtSign,
  CircleDollarSign,
  Compass,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { DockTrackerId } from '@/lib/dock/dockTrackerConfig';

export const DOCK_TRACKER_ICON: Record<DockTrackerId, LucideIcon> = {
  wallet: Wallet,
  tracker: AtSign,
  social: Wallet,
  discover: Compass,
  pulse: Activity,
  pnl: CircleDollarSign,
  alpha: Sparkles,
  squads: Users,
};
