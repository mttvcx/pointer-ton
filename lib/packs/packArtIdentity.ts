import type { PackType } from '@/types/pack';

export type PackArtChip = {
  text: string;
  className?: string;
};

export type PackArtIdentity = {
  tier: PackType;
  /** Decorative chips woven into artwork — not live data. */
  chips: PackArtChip[];
  /** Large foil callout (PnL / access). */
  heroCallout?: string;
  /** Secondary micro label. */
  microLabel?: string;
};

export const PACK_ART_IDENTITY: Record<PackType, PackArtIdentity> = {
  bronze: {
    tier: 'bronze',
    chips: [
      { text: 'First Buy' },
      { text: 'Discovery' },
      { text: 'Low MC' },
    ],
    microLabel: 'Early wallets',
  },
  silver: {
    tier: 'silver',
    chips: [
      { text: 'Smart Money' },
      { text: 'Rotation' },
      { text: 'Alpha' },
    ],
    heroCallout: 'Flow lock',
    microLabel: 'Cluster trace',
  },
  gold: {
    tier: 'gold',
    chips: [
      { text: 'Whale Entry' },
      { text: 'Conviction' },
      { text: 'Momentum' },
    ],
    heroCallout: '+2,840 SOL',
    microLabel: 'High conviction',
  },
  legendary: {
    tier: 'legendary',
    chips: [
      { text: 'Syndicate' },
      { text: 'Alpha Access' },
      { text: 'Elite desk' },
    ],
    heroCallout: '+12,400 SOL',
    microLabel: 'Rare access',
  },
};
