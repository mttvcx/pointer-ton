/**
 * Sample / stub data for the Squads discovery rehaul.
 *
 * Task AA wires the new tiered leaderboard layout (Top-3 hero cards +
 * compact rows + right-rail mini leaderboards) with hardcoded data.
 * A follow-up task will swap these constants for real API responses.
 */

export interface TraderSample {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  initials: string;
  pnl30d: number;
  pnlSparkline: number[];
  volume30d: number;
  winRate: number;
  drawdown: number;
  activeDays: number;
  squadCount: number;
  watchedVenues: number;
  tags: string[];
  ethosVerified: boolean;
  recentCalls: { ticker: string; pnlPct: number; ageHours: number }[];
  lastActiveLabel: string;
  chains: ('sol' | 'ton' | 'base' | 'bnb')[];
  followers: number;
  trustScore: number;
}

export interface SquadSample {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  emblem: string;
  pnl30d: number;
  pnlSparkline: number[];
  volume30d: number;
  memberCount: number;
  topMembers: string[];
  winRate: number;
  activeDays: number;
  tags: string[];
  ethosVerified: boolean;
  isPrivate: boolean;
  lastActiveLabel: string;
  chains: ('sol' | 'ton' | 'base' | 'bnb')[];
  followers: number;
  trustScore: number;
}

export const SAMPLE_TRADERS: TraderSample[] = [
  {
    id: 't1',
    handle: '@helix.hl',
    displayName: 'HELIX',
    initials: 'HE',
    bio: 'Macro-aware flow trader. Liquidations + structured setups with tight risk controls.',
    pnl30d: 1_820_000,
    pnlSparkline: [820, 950, 1100, 1340, 1280, 1620, 1820],
    volume30d: 18_200_000,
    winRate: 70,
    drawdown: 12,
    activeDays: 268,
    squadCount: 1,
    watchedVenues: 6,
    tags: ['Liquidations', 'Macro', 'Risk managed'],
    ethosVerified: true,
    recentCalls: [
      { ticker: 'WIF', pnlPct: 47, ageHours: 3 },
      { ticker: 'POPCAT', pnlPct: 22, ageHours: 8 },
      { ticker: 'BONK', pnlPct: -6, ageHours: 22 },
    ],
    lastActiveLabel: 'Seen · 6h',
    chains: ['sol', 'ton'],
    followers: 4720,
    trustScore: 92,
  },
  {
    id: 't2',
    handle: '@cryon',
    displayName: 'CRYON',
    initials: 'CR',
    bio: 'High-conviction multi-signal operator. Early momentum on Solana, high-velocity execution.',
    pnl30d: 1_240_000,
    pnlSparkline: [400, 560, 720, 880, 1010, 1180, 1240],
    volume30d: 2_100_000,
    winRate: 73,
    drawdown: 18,
    activeDays: 366,
    squadCount: 2,
    watchedVenues: 4,
    tags: ['Momentum', 'Low drawdown', 'High win rate'],
    ethosVerified: true,
    recentCalls: [
      { ticker: 'MEW', pnlPct: 84, ageHours: 1 },
      { ticker: 'GIGA', pnlPct: 12, ageHours: 5 },
      { ticker: 'PNUT', pnlPct: 31, ageHours: 14 },
    ],
    lastActiveLabel: 'Live · 12m',
    chains: ['sol'],
    followers: 3140,
    trustScore: 88,
  },
  {
    id: 't3',
    handle: '@ton_void',
    displayName: 'VOID',
    initials: 'VO',
    bio: 'TON-native strategist. Explicit vote workflows + objective market filters.',
    pnl30d: 964_000,
    pnlSparkline: [200, 340, 480, 620, 740, 880, 964],
    volume30d: 9_640_000,
    winRate: 68,
    drawdown: 22,
    activeDays: 401,
    squadCount: 1,
    watchedVenues: 3,
    tags: ['Jettons', 'Flows', 'Wallet graph'],
    ethosVerified: true,
    recentCalls: [
      { ticker: 'NOT', pnlPct: 28, ageHours: 4 },
      { ticker: 'DOGS', pnlPct: 19, ageHours: 11 },
      { ticker: 'HMSTR', pnlPct: -3, ageHours: 19 },
    ],
    lastActiveLabel: 'Seen · 1d',
    chains: ['ton'],
    followers: 2680,
    trustScore: 85,
  },
  {
    id: 't4',
    handle: '@orbit.sol',
    displayName: 'ORBIT',
    initials: 'OR',
    bio: 'Bonding curve specialist. Pre-migration entries on pump.fun.',
    pnl30d: 624_000,
    pnlSparkline: [400, 380, 420, 510, 580, 600, 624],
    volume30d: 4_200_000,
    winRate: 64,
    drawdown: 26,
    activeDays: 198,
    squadCount: 0,
    watchedVenues: 2,
    tags: ['Bonding curve', 'Pre-migration'],
    ethosVerified: true,
    recentCalls: [{ ticker: 'PEPE', pnlPct: 22, ageHours: 2 }],
    lastActiveLabel: 'Live · 3m',
    chains: ['sol'],
    followers: 1840,
    trustScore: 78,
  },
  {
    id: 't5',
    handle: '@yuki.base',
    displayName: 'YUKI',
    initials: 'YU',
    bio: 'Base ecosystem early-mover. Quick rotation strategist.',
    pnl30d: 412_000,
    pnlSparkline: [200, 260, 280, 340, 380, 400, 412],
    volume30d: 1_800_000,
    winRate: 61,
    drawdown: 30,
    activeDays: 142,
    squadCount: 1,
    watchedVenues: 3,
    tags: ['Base', 'Rotation'],
    ethosVerified: false,
    recentCalls: [{ ticker: 'TYBG', pnlPct: 15, ageHours: 4 }],
    lastActiveLabel: 'Seen · 12h',
    chains: ['base'],
    followers: 980,
    trustScore: 71,
  },
  {
    id: 't6',
    handle: '@nox.bnb',
    displayName: 'NOX',
    initials: 'NX',
    bio: 'BNB chain volume hunter. High-frequency dex arbitrage.',
    pnl30d: 286_000,
    pnlSparkline: [100, 140, 180, 200, 240, 270, 286],
    volume30d: 5_600_000,
    winRate: 58,
    drawdown: 35,
    activeDays: 89,
    squadCount: 0,
    watchedVenues: 4,
    tags: ['BNB', 'Arbitrage', 'High-freq'],
    ethosVerified: false,
    recentCalls: [{ ticker: 'CAKE', pnlPct: 4, ageHours: 6 }],
    lastActiveLabel: 'Seen · 8h',
    chains: ['bnb'],
    followers: 720,
    trustScore: 64,
  },
  {
    id: 't7',
    handle: '@axiom.ws',
    displayName: 'AXIOM',
    initials: 'AX',
    bio: 'Cross-chain liquidity tracker. Watches venue migrations.',
    pnl30d: 198_000,
    pnlSparkline: [120, 130, 145, 160, 170, 185, 198],
    volume30d: 3_400_000,
    winRate: 55,
    drawdown: 28,
    activeDays: 312,
    squadCount: 3,
    watchedVenues: 8,
    tags: ['Cross-chain', 'Migration'],
    ethosVerified: true,
    recentCalls: [{ ticker: 'JUP', pnlPct: 9, ageHours: 18 }],
    lastActiveLabel: 'Seen · 2d',
    chains: ['sol', 'base', 'bnb'],
    followers: 2240,
    trustScore: 76,
  },
  {
    id: 't8',
    handle: '@kai.dev',
    displayName: 'KAI',
    initials: 'KA',
    bio: 'Dev wallet stalker. On-chain deployer behavior analyst.',
    pnl30d: 142_000,
    pnlSparkline: [80, 90, 110, 115, 130, 138, 142],
    volume30d: 980_000,
    winRate: 67,
    drawdown: 19,
    activeDays: 245,
    squadCount: 1,
    watchedVenues: 2,
    tags: ['Dev wallet', 'On-chain'],
    ethosVerified: true,
    recentCalls: [{ ticker: 'GROK', pnlPct: 38, ageHours: 7 }],
    lastActiveLabel: 'Seen · 4h',
    chains: ['sol'],
    followers: 1340,
    trustScore: 73,
  },
];

export const SAMPLE_SQUADS: SquadSample[] = [
  {
    id: 's1',
    handle: '@phoenix-squad',
    displayName: 'PHOENIX',
    emblem: '🔥',
    bio: 'Memecoin specialists. 7 members, $42M combined 30d volume.',
    pnl30d: 4_240_000,
    pnlSparkline: [1800, 2400, 2900, 3200, 3700, 4000, 4240],
    volume30d: 42_000_000,
    memberCount: 7,
    topMembers: ['@helix.hl', '@cryon', '@orbit.sol'],
    winRate: 71,
    activeDays: 312,
    tags: ['Memecoin', 'High velocity', 'Public'],
    ethosVerified: true,
    isPrivate: false,
    lastActiveLabel: 'Live · 4m',
    chains: ['sol'],
    followers: 8920,
    trustScore: 90,
  },
  {
    id: 's2',
    handle: '@ton-collective',
    displayName: 'TON COLLECTIVE',
    emblem: '◆',
    bio: 'TON ecosystem strategists. Curated jettons, wallet graphs.',
    pnl30d: 2_180_000,
    pnlSparkline: [800, 1100, 1400, 1620, 1800, 2000, 2180],
    volume30d: 22_400_000,
    memberCount: 5,
    topMembers: ['@ton_void', '@axiom.ws'],
    winRate: 66,
    activeDays: 256,
    tags: ['TON', 'Curated'],
    ethosVerified: true,
    isPrivate: false,
    lastActiveLabel: 'Live · 18m',
    chains: ['ton'],
    followers: 4640,
    trustScore: 84,
  },
  {
    id: 's3',
    handle: '@base-pulse',
    displayName: 'BASE PULSE',
    emblem: '⬢',
    bio: 'Base chain early-stage hunters. 4 members, low drawdown discipline.',
    pnl30d: 1_320_000,
    pnlSparkline: [400, 600, 800, 950, 1100, 1240, 1320],
    volume30d: 14_800_000,
    memberCount: 4,
    topMembers: ['@yuki.base'],
    winRate: 69,
    activeDays: 178,
    tags: ['Base', 'Low drawdown'],
    ethosVerified: true,
    isPrivate: false,
    lastActiveLabel: 'Seen · 2h',
    chains: ['base'],
    followers: 2120,
    trustScore: 81,
  },
  {
    id: 's4',
    handle: '@solana-alpha',
    displayName: 'SOLANA ALPHA',
    emblem: '◎',
    bio: 'Solana-only group. High signal, low noise.',
    pnl30d: 884_000,
    pnlSparkline: [300, 420, 550, 640, 720, 820, 884],
    volume30d: 11_200_000,
    memberCount: 6,
    topMembers: ['@cryon', '@orbit.sol', '@kai.dev'],
    winRate: 64,
    activeDays: 198,
    tags: ['Solana', 'Curated'],
    ethosVerified: true,
    isPrivate: false,
    lastActiveLabel: 'Seen · 6h',
    chains: ['sol'],
    followers: 1860,
    trustScore: 78,
  },
  {
    id: 's5',
    handle: '@inner-circle',
    displayName: 'INNER CIRCLE',
    emblem: '⬡',
    bio: 'Private group — not shown in discovery.',
    pnl30d: 6_120_000,
    pnlSparkline: [],
    volume30d: 0,
    memberCount: 3,
    topMembers: [],
    winRate: 0,
    activeDays: 0,
    tags: [],
    ethosVerified: true,
    isPrivate: true,
    lastActiveLabel: '',
    chains: [],
    followers: 0,
    trustScore: 0,
  },
];

export interface RailEntry {
  handle: string;
  value: string;
  delta: string;
}

export const SAMPLE_RIGHT_RAIL: {
  topPnl7d: RailEntry[];
  topWinRate: RailEntry[];
  risingThisWeek: RailEntry[];
  mostFollowed: RailEntry[];
  topSquadsPnl7d: RailEntry[];
  topSquadsWinRate: RailEntry[];
  risingSquadsThisWeek: RailEntry[];
  mostFollowedSquads: RailEntry[];
} = {
  topPnl7d: [
    { handle: '@helix.hl', value: '$642K', delta: '+18%' },
    { handle: '@cryon', value: '$418K', delta: '+12%' },
    { handle: '@orbit.sol', value: '$294K', delta: '+8%' },
    { handle: '@ton_void', value: '$220K', delta: '+5%' },
    { handle: '@yuki.base', value: '$148K', delta: '+3%' },
  ],
  topWinRate: [
    { handle: '@cryon', value: '73%', delta: '90d' },
    { handle: '@helix.hl', value: '70%', delta: '90d' },
    { handle: '@base-pulse', value: '69%', delta: '90d' },
    { handle: '@ton_void', value: '68%', delta: '90d' },
    { handle: '@kai.dev', value: '67%', delta: '90d' },
  ],
  risingThisWeek: [
    { handle: '@yuki.base', value: '+42 ranks', delta: '7d' },
    { handle: '@kai.dev', value: '+28 ranks', delta: '7d' },
    { handle: '@nox.bnb', value: '+21 ranks', delta: '7d' },
    { handle: '@axiom.ws', value: '+14 ranks', delta: '7d' },
    { handle: '@orbit.sol', value: '+9 ranks', delta: '7d' },
  ],
  mostFollowed: [
    { handle: '@helix.hl', value: '4.7K', delta: 'followers' },
    { handle: '@cryon', value: '3.1K', delta: 'followers' },
    { handle: '@ton_void', value: '2.7K', delta: 'followers' },
    { handle: '@axiom.ws', value: '2.2K', delta: 'followers' },
    { handle: '@orbit.sol', value: '1.8K', delta: 'followers' },
  ],
  topSquadsPnl7d: [
    { handle: '@phoenix-squad', value: '$1.4M', delta: '+22%' },
    { handle: '@ton-collective', value: '$720K', delta: '+14%' },
    { handle: '@base-pulse', value: '$440K', delta: '+9%' },
    { handle: '@solana-alpha', value: '$310K', delta: '+6%' },
  ],
  topSquadsWinRate: [
    { handle: '@phoenix-squad', value: '71%', delta: '90d' },
    { handle: '@base-pulse', value: '69%', delta: '90d' },
    { handle: '@ton-collective', value: '66%', delta: '90d' },
    { handle: '@solana-alpha', value: '64%', delta: '90d' },
  ],
  risingSquadsThisWeek: [
    { handle: '@base-pulse', value: '+18 ranks', delta: '7d' },
    { handle: '@solana-alpha', value: '+11 ranks', delta: '7d' },
    { handle: '@ton-collective', value: '+7 ranks', delta: '7d' },
  ],
  mostFollowedSquads: [
    { handle: '@phoenix-squad', value: '8.9K', delta: 'followers' },
    { handle: '@ton-collective', value: '4.6K', delta: 'followers' },
    { handle: '@base-pulse', value: '2.1K', delta: 'followers' },
    { handle: '@solana-alpha', value: '1.9K', delta: 'followers' },
  ],
};
