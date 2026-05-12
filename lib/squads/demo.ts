import type { EthosProfileSnapshot } from '@/lib/ethos/types';
import type { ChainFocus, OperatorSignalLevel, TradingStyle } from '@/lib/squads/types';
import type { OperatorSignal } from '@/lib/squads/operatorSignal';

export type DemoTrader = {
  id: string;
  handle: string;
  displayName: string;
  monogram: string;
  avatarTint: string;
  chains: ChainFocus[];
  styles: TradingStyle[];
  ethos: EthosProfileSnapshot;
  ethosVerified: boolean;
  operatorLevel: OperatorSignalLevel;
  operator: OperatorSignal;
  /** Narrative line for directory cards */
  shortBio: string;
  /** Pill labels for UI */
  strategyTags: string[];
  chainTags: string[];
  volume30dUsd: number;
  lookingForSquad: boolean;
  lfsPitch?: string;
  /** LFS directory */
  lfsLookingFor?: string;
  lfsEnvironment?: string;
  profileViews?: number;
  invitesReceived?: number;
  mutualSquads: number;
  mutualVouches: number;
  riskFlags: string[];
};

export type DemoSquad = {
  id: string;
  slug: string;
  name: string;
  monogram: string;
  shortDescription: string;
  fullDescription: string;
  chains: ChainFocus[];
  styles: TradingStyle[];
  visibility: 'public' | 'request_to_join' | 'invite_only' | 'private';
  members: number;
  openSeatsCount: number;
  ethosFloor: number;
  trustRequirement: string;
  signalGrade: OperatorSignalLevel;
  recentActivityCount: number;
  trustMode: string;
};

export type DemoTokenPulse = {
  mint: string;
  symbol: string;
  name: string;
  chain: ChainFocus;
  mcUsd: number;
  change1hPct: number;
  watchers: number;
};

export type DemoRichInvite = {
  id: string;
  squadSlug: string;
  squadName: string;
  monogram: string;
  fromHandle: string;
  /** Sender display polish */
  senderMonogram?: string;
  senderRole?: string;
  ago: string;
  /** Human-readable countdown */
  expiresInLabel?: string;
  squadTags?: string[];
  roomType: string;
  access: string;
  trustRequirement: string;
  membersCurrent: number;
  membersCap: number;
  pitch: string;
};

export type DemoRichRequest = {
  id: string;
  squadSlug: string;
  squadName: string;
  monogram: string;
  kind: 'outgoing' | 'incoming';
  status: 'pending' | 'awaiting_review' | 'approved';
  ago: string;
  message?: string;
  actorHandle?: string;
};

export type DemoRoomActivity = {
  id: string;
  text: string;
  ago: string;
};

const op = (
  level: OperatorSignalLevel,
  summary: string,
  factors: OperatorSignal['factors'],
): OperatorSignal => ({ level, summary, factors });

export const DEMO_TRADERS: DemoTrader[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    handle: 'cryon',
    displayName: 'CRYON',
    monogram: 'CR',
    avatarTint: 'bg-[#12202c] ring-1 ring-[#234a62]',
    chains: ['sol', 'base'],
    styles: ['new_pairs', 'trenches'],
    ethosVerified: true,
    ethos: { score: 1820, level: 'reputable', profileUrl: 'https://app.ethos.network/' },
    operatorLevel: 'high',
    operator: op('high', 'High-conviction multi-signal operator across Solana and Base.', [
      { label: 'Ethos', detail: 'Reputable tier — externally attributed identity signal.' },
      { label: 'Performance', detail: 'Strong momentum read and disciplined size.' },
      { label: 'On-chain', detail: 'Elevated smart-money-aligned flow in audited window.' },
    ]),
    shortBio:
      'High-conviction multi-signal operator. Specializes in early momentum on Solana and high-velocity execution.',
    strategyTags: ['Momentum', 'Low drawdown', 'High win rate'],
    chainTags: ['Solana', 'Base'],
    volume30dUsd: 2_100_000,
    lookingForSquad: true,
    lfsPitch: 'Momentum-first execution with repeatable sizing and moderated deploy votes.',
    lfsLookingFor: 'Elite Sol/Base desk · tight risk playbook · reproducible setups.',
    lfsEnvironment: 'Low noise · high integrity · annotated calls only.',
    profileViews: 128,
    invitesReceived: 2,
    mutualSquads: 2,
    mutualVouches: 4,
    riskFlags: [],
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    handle: 'helix.hl',
    displayName: 'HELIX',
    monogram: 'HE',
    avatarTint: 'bg-[#0f1f1a] ring-1 ring-[#266350]',
    chains: ['hyperliquid', 'sol'],
    styles: ['perps', 'alerts'],
    ethosVerified: true,
    ethos: { score: 2105, level: 'exemplary', profileUrl: 'https://app.ethos.network/' },
    operatorLevel: 'high',
    operator: op('high', 'Macro-aware flow trader with structured risk.', [
      { label: 'Ethos', detail: 'Exemplary credibility band.' },
      { label: 'Performance', detail: 'Consistent liquidation and basis reads.' },
      { label: 'On-chain', detail: 'Heavy HL + Sol execution footprint.' },
    ]),
    shortBio:
      'Macro-aware flow trader. Strong in liquidations and structured setups with tight risk controls.',
    strategyTags: ['Liquidations', 'Macro', 'Risk managed'],
    chainTags: ['Solana', 'Hyperliquid'],
    volume30dUsd: 18_200_000,
    lookingForSquad: true,
    lfsPitch: 'Perps-heavy room with explicit deployer vote workflow and moderated alerts.',
    lfsLookingFor: 'Structured HL desk · shared risk playbook · moderated deployer votes.',
    lfsEnvironment: 'Serious terminals only · sized integrity · minimal noise.',
    profileViews: 312,
    invitesReceived: 6,
    mutualSquads: 1,
    mutualVouches: 7,
    riskFlags: [],
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    handle: 'ton_void',
    displayName: 'VOID',
    monogram: 'VO',
    avatarTint: 'bg-[#171328] ring-1 ring-[#45306b]',
    chains: ['ton', 'sol'],
    styles: ['wallets', 'trenches'],
    ethosVerified: false,
    ethos: { score: 1310, level: 'neutral', profileUrl: 'https://app.ethos.network/' },
    operatorLevel: 'medium',
    operator: op('medium', 'TON-native strategist with objective filters.', [
      { label: 'Ethos', detail: 'Neutral — optional identity linkage.' },
      { label: 'Performance', detail: 'Steady TON-first rotation with tracked drawdown.' },
      { label: 'On-chain', detail: 'Wallet-graph aware; explicit vote workflows.' },
    ]),
    shortBio:
      'TON-native strategist using explicit vote workflows and objective market filters.',
    strategyTags: ['Jettons', 'Flows', 'Wallet graph'],
    chainTags: ['TON'],
    volume30dUsd: 9_640_000,
    lookingForSquad: true,
    lfsPitch: 'Mission-aligned squad with transparent performance and moderator-led votes.',
    lfsLookingFor: 'Cross-chain squad with disciplined TON + Sol workflow.',
    lfsEnvironment: 'Signal-first rooms · reproducible setups · annotated calls.',
    profileViews: 97,
    invitesReceived: 3,
    mutualSquads: 0,
    mutualVouches: 1,
    riskFlags: [],
  },
];

export const DEMO_SQUADS: DemoSquad[] = [
  {
    id: 'sq_1',
    slug: 'archon-desk',
    name: 'ARCHON // DESK',
    monogram: 'AR',
    shortDescription:
      'Sol/Base trench operators. High conviction trades, tight risk, and structured coordination.',
    fullDescription:
      'Sol/Base trench operators. High conviction trades, tight risk, and structured coordination.',
    chains: ['sol', 'base'],
    styles: ['trenches', 'new_pairs'],
    visibility: 'request_to_join',
    members: 14,
    openSeatsCount: 6,
    ethosFloor: 1680,
    trustRequirement: 'High signal or above · manual review',
    signalGrade: 'high',
    recentActivityCount: 28,
    trustMode: 'Request to join',
  },
  {
    id: 'sq_2',
    slug: 'perimeter-hl',
    name: 'PERIMETER',
    monogram: 'PE',
    shortDescription:
      'Hyperliquid-first operators. Systematic execution and AI-augmented risk management.',
    fullDescription:
      'Hyperliquid-first operators. Systematic execution and AI-augmented risk management.',
    chains: ['hyperliquid', 'sol'],
    styles: ['perps', 'alerts'],
    visibility: 'invite_only',
    members: 9,
    openSeatsCount: 2,
    ethosFloor: 1920,
    trustRequirement: 'High signal operators · referral or invite',
    signalGrade: 'high',
    recentActivityCount: 14,
    trustMode: 'Invite only · private room',
  },
  {
    id: 'sq_3',
    slug: 'ton-signal',
    name: 'TON SIGNAL',
    monogram: 'TS',
    shortDescription:
      'TON-native signalers and cross-chain alpha. Fast moves, clean calls, and transparent performance.',
    fullDescription:
      'TON-native signalers and cross-chain alpha. Fast moves, clean calls, and transparent performance.',
    chains: ['ton', 'multi'],
    styles: ['wallets', 'trenches'],
    visibility: 'public',
    members: 26,
    openSeatsCount: 8,
    ethosFloor: 1420,
    trustRequirement: 'Ethos floor · standard review',
    signalGrade: 'medium',
    recentActivityCount: 41,
    trustMode: 'Public discoverable',
  },
];

export const DEMO_INVITE_PRIMARY: DemoRichInvite = {
  id: 'inv_perimeter',
  squadSlug: 'perimeter-hl',
  squadName: 'PERIMETER',
  monogram: 'PE',
  fromHandle: 'helix.hl',
  senderMonogram: 'HE',
  senderRole: 'Room operator',
  ago: '12m ago',
  expiresInLabel: 'Expires in 6d 22h',
  squadTags: ['Hyperliquid', 'Solana', 'High signal'],
  roomType: 'Private room',
  access: 'Invite only',
  trustRequirement: 'High signal or above',
  membersCurrent: 42,
  membersCap: 75,
  pitch: 'High-conviction market calls, setups, and trade recaps.',
};

export const DEMO_REQUESTS_ROWS: DemoRichRequest[] = [
  {
    id: 'rq_out_archon',
    squadSlug: 'archon-desk',
    squadName: 'ARCHON // DESK',
    monogram: 'AR',
    kind: 'outgoing',
    status: 'pending',
    ago: '24m ago',
    message: 'Excited to contribute and learn from the community.',
  },
  {
    id: 'rq_in_ton',
    squadSlug: 'ton-signal',
    squadName: 'TON SIGNAL',
    monogram: 'VO',
    kind: 'incoming',
    status: 'awaiting_review',
    ago: '1h ago',
    actorHandle: 'ton_void',
  },
  {
    id: 'rq_in_hq',
    squadSlug: 'helix-hq',
    squadName: 'HELIX HQ',
    monogram: 'HE',
    kind: 'incoming',
    status: 'approved',
    ago: '2h ago',
    actorHandle: 'helix.hl',
  },
];

export const DEMO_ROOM_FEED: DemoTokenPulse[] = [
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'sol',
    mcUsd: 2_400_000_000,
    change1hPct: 0.01,
    watchers: 42,
  },
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    chain: 'sol',
    mcUsd: 1_200_000_000_000,
    change1hPct: 0.65,
    watchers: 128,
  },
];

export const DEMO_CHAT = [
  { id: '1', who: 'CRYON', text: 'Deployer clean — see vote thread.', at: '2m' },
  { id: '2', who: 'HELIX', text: 'HL basis lining up with spot leg on Sol.', at: '5m' },
  { id: '3', who: 'ROOM', text: 'Three Reputable+ operators flagged deployer OK.', at: '9m' },
] as const;

export const DEMO_ROOM_ACTIVITIES: DemoRoomActivity[] = [
  { id: 'a1', text: 'CRYON posted shared chart · SOL/USDC corridor', ago: '3m' },
  { id: 'a2', text: 'New vote: extend deployer checklist', ago: '18m' },
  { id: 'a3', text: 'VOID dropped TON liquidity read', ago: '42m' },
  { id: 'a4', text: 'New member request · awaiting admin', ago: '1h' },
  { id: 'a5', text: 'Room decision · passed quorum', ago: '3h' },
];

export const DEMO_AI_SUMMARY =
  'Early Sol liquidity with Base confirmation in play; HL book looks crowded but orderly—confirm in the pinned vote thread before sizing up.';

export const DEMO_PINNED_SYMBOLS = ['SOL', 'WIF', 'USDC'];
