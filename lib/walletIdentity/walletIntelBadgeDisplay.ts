import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ChefHat,
  Crosshair,
  Fish,
  Flame,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';

export type WalletIntelBadgeDisplay = {
  Icon: LucideIcon;
  iconClass: string;
  tooltip: string;
  textLabel: string;
};

/** Icon + tooltip mapping shared by desk rows and dossier chips (TokenDetailView parity). */
export const WALLET_INTEL_BADGE_DISPLAY: Record<WalletIntelBadgeKind, WalletIntelBadgeDisplay> = {
  dev: {
    Icon: ChefHat,
    iconClass: 'text-signal-warn',
    tooltip: 'Developer',
    textLabel: 'DEV',
  },
  sniper: {
    Icon: Crosshair,
    iconClass: 'text-signal-bear',
    tooltip: 'Sniper',
    textLabel: 'SNIPER',
  },
  insider: {
    Icon: AlertCircle,
    iconClass: 'text-signal-bear',
    tooltip: 'Bundler',
    textLabel: 'INSIDER',
  },
  whale: {
    Icon: Fish,
    iconClass: 'text-signal-info',
    tooltip: 'Whale',
    textLabel: 'WHALE',
  },
  tracked: {
    Icon: Target,
    iconClass: 'text-accent-primary',
    tooltip: 'Tracked',
    textLabel: 'TRACKED',
  },
  kol: {
    Icon: Star,
    iconClass: 'text-signal-info',
    tooltip: 'KOL',
    textLabel: 'KOL',
  },
  smart_money: {
    Icon: TrendingUp,
    iconClass: 'text-signal-bull',
    tooltip: 'Smart Money',
    textLabel: 'SMART',
  },
  top_trader: {
    Icon: Trophy,
    iconClass: 'text-accent-primary',
    tooltip: 'Top Trader',
    textLabel: 'TOP',
  },
  high_win_rate: {
    Icon: TrendingUp,
    iconClass: 'text-signal-bull',
    tooltip: 'High Win Rate',
    textLabel: 'WIN%',
  },
  fresh: {
    Icon: Sparkles,
    iconClass: 'text-signal-warn',
    tooltip: 'Fresh Wallet',
    textLabel: 'FRESH',
  },
  renamed: {
    Icon: Flame,
    iconClass: 'text-fg-muted',
    tooltip: 'Renamed',
    textLabel: 'RENAMED',
  },
};

export function walletIntelBadgeDisplay(kind: WalletIntelBadgeKind): WalletIntelBadgeDisplay {
  return (
    WALLET_INTEL_BADGE_DISPLAY[kind] ?? {
      Icon: Star,
      iconClass: 'text-fg-muted',
      tooltip: String(kind).replace(/_/g, ' '),
      textLabel: String(kind).toUpperCase(),
    }
  );
}
