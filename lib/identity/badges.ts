import type { IdentityBadgeKind, IdentityPrimaryCategory } from '@/lib/identity/types';

export const IDENTITY_BADGE_LABEL: Record<IdentityBadgeKind, string> = {
  KOL: 'KOL',
  'Smart Money': 'Smart',
  Whale: 'Whale',
  Sniper: 'Sniper',
  'Fresh Wallet': 'Fresh',
  Insider: 'Insider',
  Dev: 'Dev',
  Team: 'Team',
  Fund: 'Fund',
  'Market Maker': 'MM',
  Builder: 'Builder',
  Verified: 'Verified',
  'Pointer Verified': 'PTR',
  'PTCS Qualified': 'PTCS',
};

export const IDENTITY_BADGE_TONE: Record<IdentityBadgeKind, string> = {
  KOL: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  'Smart Money': 'border-violet-500/45 bg-violet-500/10 text-violet-200',
  Whale: 'border-sky-500/45 bg-sky-500/10 text-sky-200',
  Sniper: 'border-rose-500/45 bg-rose-500/10 text-rose-200',
  'Fresh Wallet': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  Insider: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200',
  Dev: 'border-orange-500/45 bg-orange-500/10 text-orange-200',
  Team: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  Fund: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
  'Market Maker': 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
  Builder: 'border-teal-500/40 bg-teal-500/10 text-teal-200',
  Verified: 'border-blue-500/50 bg-blue-500/10 text-blue-200',
  'Pointer Verified': 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary',
  'PTCS Qualified': 'border-yellow-500/50 bg-yellow-500/10 text-yellow-100',
};

export function badgesForCategory(cat: IdentityPrimaryCategory): IdentityBadgeKind[] {
  switch (cat) {
    case 'kol':
      return ['KOL'];
    case 'smart_money':
      return ['Smart Money'];
    case 'whale':
      return ['Whale'];
    case 'sniper':
      return ['Sniper'];
    case 'insider':
      return ['Insider'];
    case 'dev':
      return ['Dev'];
    case 'fund':
      return ['Fund'];
    case 'market_maker':
      return ['Market Maker'];
    default:
      return [];
  }
}

export function sourcePublicLabel(source: string): string {
  const s = source.toLowerCase();
  if (s === 'kolscan') return 'Imported from Kolscan';
  if (s === 'gmgn') return 'Imported from GMGN';
  if (s === 'pointer') return 'Pointer verified';
  if (s === 'manual') return 'Manual import';
  return `Imported label · ${source}`;
}
