import type { EcosystemCampaignId } from '@/components/points/pointsUiConfig';

export type OpportunityKind =
  | 'live'
  | 'coming_soon'
  | 'snapshot_soon'
  | 'partner_verified'
  | 'boosted_route';

export type DemoOpportunity = {
  id: string;
  projectName: string;
  /** Single-letter or short monogram inside logo tile */
  logoLetter: string;
  logoClassName: string;
  chainLabel: string;
  kind: OpportunityKind;
  rewardType: string;
  eligibility: string;
  timeLabel: string;
  showVerify: boolean;
};

export type EcosystemRadarStats = {
  boostLabel: string;
  routesLabel: string;
  referralWeight: string;
};

export const ECOSYSTEM_RADAR_STATS: Record<EcosystemCampaignId, EcosystemRadarStats> = {
  sol: {
    boostLabel: 'Volume ×1.15',
    routesLabel: '12 active venues',
    referralWeight: 'Quality 0.94',
  },
  ton: {
    boostLabel: 'Pulse ×1.08',
    routesLabel: 'Native + bridges',
    referralWeight: 'Retention-first',
  },
  base: {
    boostLabel: 'Season ×1.05',
    routesLabel: '8 routes',
    referralWeight: 'Cross-chain OK',
  },
  bnb: {
    boostLabel: 'Discover ×1.06',
    routesLabel: 'Partner mesh',
    referralWeight: 'Partner codes',
  },
  hyperliquid: {
    boostLabel: 'Perp depth',
    routesLabel: 'HL book',
    referralWeight: 'Maker bias',
  },
};

const KIND_LABEL: Record<OpportunityKind, string> = {
  live: 'LIVE',
  coming_soon: 'Coming soon',
  snapshot_soon: 'Snapshot soon',
  partner_verified: 'Partner verified',
  boosted_route: 'Boosted route',
};

export function opportunityStatusLabel(kind: OpportunityKind): string {
  return KIND_LABEL[kind];
}

export const DEMO_ECOSYSTEM_OPPORTUNITIES: Record<EcosystemCampaignId, DemoOpportunity[]> = {
  sol: [
    {
      id: 'sol-1',
      projectName: 'Jupiter routing',
      logoLetter: 'J',
      logoClassName: 'from-violet-500/90 to-fuchsia-600/80',
      chainLabel: 'Solana',
      kind: 'live',
      rewardType: 'Trading points · fee share',
      eligibility: 'Route via Pointer + wallet linked',
      timeLabel: 'Rolling season',
      showVerify: false,
    },
    {
      id: 'sol-2',
      projectName: 'Raydium pools',
      logoLetter: 'R',
      logoClassName: 'from-emerald-500/85 to-cyan-600/75',
      chainLabel: 'Solana',
      kind: 'boosted_route',
      rewardType: 'Boosted execution credits',
      eligibility: 'Min volume threshold applies',
      timeLabel: 'Ends in 18d',
      showVerify: true,
    },
    {
      id: 'sol-3',
      projectName: 'Solana season snapshot',
      logoLetter: 'S',
      logoClassName: 'from-slate-600/90 to-slate-800/90',
      chainLabel: 'Solana',
      kind: 'snapshot_soon',
      rewardType: 'Allocation eligibility',
      eligibility: 'Anti-sybil + active days',
      timeLabel: 'Snapshot · 6d',
      showVerify: true,
    },
  ],
  ton: [
    {
      id: 'ton-1',
      projectName: 'STON.fi routing',
      logoLetter: 'S',
      logoClassName: 'from-sky-500/85 to-blue-700/80',
      chainLabel: 'TON',
      kind: 'live',
      rewardType: 'Pulse points · referrals',
      eligibility: 'TON wallet + trades',
      timeLabel: 'Live',
      showVerify: false,
    },
    {
      id: 'ton-2',
      projectName: 'Dedust aggregation',
      logoLetter: 'D',
      logoClassName: 'from-indigo-500/80 to-violet-700/75',
      chainLabel: 'TON',
      kind: 'partner_verified',
      rewardType: 'Partner multiplier',
      eligibility: 'Verified route list',
      timeLabel: 'Ongoing',
      showVerify: true,
    },
    {
      id: 'ton-3',
      projectName: 'TON ecosystem wave',
      logoLetter: 'T',
      logoClassName: 'from-cyan-500/75 to-accent-primary/90',
      chainLabel: 'TON',
      kind: 'coming_soon',
      rewardType: 'Season pool (disclosed)',
      eligibility: 'Complete onboarding',
      timeLabel: 'Opens · Q2',
      showVerify: false,
    },
  ],
  base: [
    {
      id: 'base-1',
      projectName: 'Base deployment lane',
      logoLetter: 'B',
      logoClassName: 'from-blue-600/90 to-indigo-700/85',
      chainLabel: 'Base',
      kind: 'live',
      rewardType: 'Cross-chain volume weight',
      eligibility: 'Bridge + trade via Pointer',
      timeLabel: 'Rolling',
      showVerify: true,
    },
    {
      id: 'base-2',
      projectName: 'Coinbase Wallet bonus',
      logoLetter: 'C',
      logoClassName: 'from-blue-500/70 to-blue-800/80',
      chainLabel: 'Base',
      kind: 'partner_verified',
      rewardType: 'Connection bonus (demo)',
      eligibility: 'Link compatible wallet',
      timeLabel: 'While supplies last',
      showVerify: true,
    },
    {
      id: 'base-3',
      projectName: 'Base snapshot window',
      logoLetter: 'Σ',
      logoClassName: 'from-slate-500/80 to-slate-700/85',
      chainLabel: 'Base',
      kind: 'snapshot_soon',
      rewardType: 'Eligibility checkpoint',
      eligibility: 'Hold routes disclosed per season',
      timeLabel: 'Snapshot · 11d',
      showVerify: false,
    },
  ],
  bnb: [
    {
      id: 'bnb-1',
      projectName: 'Pancake routing',
      logoLetter: 'P',
      logoClassName: 'from-amber-400/95 to-yellow-600/80',
      chainLabel: 'BNB Chain',
      kind: 'live',
      rewardType: 'Execution points',
      eligibility: 'Trade tracked venues',
      timeLabel: 'Live',
      showVerify: false,
    },
    {
      id: 'bnb-2',
      projectName: 'BNB partner mesh',
      logoLetter: 'M',
      logoClassName: 'from-orange-500/85 to-rose-700/75',
      chainLabel: 'BNB Chain',
      kind: 'partner_verified',
      rewardType: 'Partner referrals',
      eligibility: 'Apply allowlist',
      timeLabel: 'Review · 72h',
      showVerify: true,
    },
    {
      id: 'bnb-3',
      projectName: 'BNB wave II',
      logoLetter: 'W',
      logoClassName: 'from-yellow-500/70 to-amber-800/85',
      chainLabel: 'BNB Chain',
      kind: 'coming_soon',
      rewardType: 'Season rewards',
      eligibility: 'TBA with disclosure',
      timeLabel: 'Soon',
      showVerify: false,
    },
  ],
  hyperliquid: [
    {
      id: 'hl-1',
      projectName: 'Hyperliquid perps',
      logoLetter: 'H',
      logoClassName: 'from-emerald-400/90 to-teal-800/85',
      chainLabel: 'Hyperliquid',
      kind: 'live',
      rewardType: 'Perp volume · retention',
      eligibility: 'HL wallet linkage',
      timeLabel: 'Rolling',
      showVerify: true,
    },
    {
      id: 'hl-2',
      projectName: 'Maker incentive lane',
      logoLetter: 'M',
      logoClassName: 'from-green-500/75 to-emerald-900/80',
      chainLabel: 'Hyperliquid',
      kind: 'boosted_route',
      rewardType: 'Maker boost window',
      eligibility: 'Depth + time on book',
      timeLabel: 'Ends · 9d',
      showVerify: false,
    },
    {
      id: 'hl-3',
      projectName: 'HL allocation radar',
      logoLetter: 'R',
      logoClassName: 'from-zinc-600/90 to-zinc-900/90',
      chainLabel: 'Hyperliquid',
      kind: 'snapshot_soon',
      rewardType: 'Checkpoint eligibility',
      eligibility: 'Disclosed criteria',
      timeLabel: 'Snapshot · 4d',
      showVerify: true,
    },
  ],
};
