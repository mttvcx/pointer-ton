import type { PackType, RewardRarity } from '@/types/pack';

export const RARITY_THEME: Record<
  RewardRarity,
  { label: string; ring: string; glow: string; beam: string; text: string; bg: string }
> = {
  common: {
    label: 'Common',
    ring: 'ring-white/15',
    glow: 'shadow-[0_0_40px_-12px_rgba(148,163,184,0.35)]',
    beam: 'from-slate-400/20',
    text: 'text-slate-200',
    bg: 'bg-gradient-to-br from-slate-700/40 to-slate-900/80',
  },
  uncommon: {
    label: 'Uncommon',
    ring: 'ring-emerald-400/35',
    glow: 'shadow-[0_0_44px_-10px_rgba(52,211,153,0.45)]',
    beam: 'from-emerald-400/25',
    text: 'text-emerald-200',
    bg: 'bg-gradient-to-br from-emerald-900/50 to-slate-950/90',
  },
  rare: {
    label: 'Rare',
    ring: 'ring-sky-400/40',
    glow: 'shadow-[0_0_48px_-8px_rgba(56,189,248,0.5)]',
    beam: 'from-sky-400/30',
    text: 'text-sky-200',
    bg: 'bg-gradient-to-br from-sky-900/55 to-slate-950/90',
  },
  epic: {
    label: 'Epic',
    ring: 'ring-violet-400/45',
    glow: 'shadow-[0_0_52px_-6px_rgba(167,139,250,0.55)]',
    beam: 'from-violet-400/35',
    text: 'text-violet-200',
    bg: 'bg-gradient-to-br from-violet-900/55 to-slate-950/90',
  },
  legendary: {
    label: 'Legendary',
    ring: 'ring-amber-300/50',
    glow: 'shadow-[0_0_56px_-4px_rgba(251,191,36,0.6)]',
    beam: 'from-amber-300/40',
    text: 'text-amber-100',
    bg: 'bg-gradient-to-br from-amber-800/50 to-slate-950/90',
  },
  mythic: {
    label: 'Mythic',
    ring: 'ring-fuchsia-300/55',
    glow: 'shadow-[0_0_64px_0px_rgba(232,121,249,0.55)]',
    beam: 'from-fuchsia-400/45',
    text: 'text-fuchsia-100',
    bg: 'bg-gradient-to-br from-fuchsia-700/55 via-violet-900/40 to-slate-950/95',
  },
};

export const PACK_VISUAL: Record<
  PackType,
  { accent: string; border: string; glow: string; gradient: string; icon: string }
> = {
  bronze: {
    accent: 'text-amber-600',
    border: 'border-amber-700/40',
    glow: 'shadow-[0_24px_80px_-24px_rgba(180,83,9,0.45)]',
    gradient: 'from-amber-950/80 via-amber-900/30 to-bg-base',
    icon: '🥉',
  },
  silver: {
    accent: 'text-slate-200',
    border: 'border-slate-400/35',
    glow: 'shadow-[0_24px_80px_-24px_rgba(148,163,184,0.4)]',
    gradient: 'from-slate-800/80 via-slate-700/25 to-bg-base',
    icon: '🥈',
  },
  gold: {
    accent: 'text-yellow-300',
    border: 'border-yellow-500/40',
    glow: 'shadow-[0_28px_90px_-20px_rgba(234,179,8,0.5)]',
    gradient: 'from-yellow-950/70 via-amber-900/35 to-bg-base',
    icon: '🥇',
  },
  legendary: {
    accent: 'text-violet-200',
    border: 'border-violet-400/45',
    glow: 'shadow-[0_32px_100px_-16px_rgba(167,139,250,0.55)]',
    gradient: 'from-violet-950/80 via-fuchsia-900/30 to-bg-base',
    icon: '✦',
  },
};

export function rewardKindLabel(kind: string): string {
  switch (kind) {
    case 'token_reward':
      return 'Token';
    case 'cashback_multiplier':
      return 'Cashback';
    case 'points_multiplier':
      return 'Points';
    case 'rare_access_badge':
      return 'Access';
    case 'legendary_reward':
      return 'Legendary';
    default:
      return 'Reward';
  }
}
