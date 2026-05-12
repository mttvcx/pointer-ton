import type { AppChainId } from '@/lib/chains/appChain';
import type { WalletPositionRow } from '@/lib/wallet-analytics/types';

function seedNum(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = Math.imul(31, h) + addr.charCodeAt(i);
  }
  return Math.abs(h);
}

/**
 * Rich demo positions so Share PnL / composer can be exercised from any wallet row click
 * (merged into wallet intel when `rowDemo` is enabled).
 */
const DEMO_TOKENS: { symbol: string; name: string; mint: string }[] = [
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  {
    symbol: 'RAY',
    name: 'Raydium',
    mint: '4k3Dyjzvzp8eM528UX3Ac7MFXQPHYXG2qbqEHxMwWKGg',
  },
];

export function demoWalletPositions(walletAddress: string, chain: AppChainId): WalletPositionRow[] {
  const s = seedNum(walletAddress);
  const mk = (i: number): WalletPositionRow => {
    const bought = 12000 + ((s + i * 97) % 8000);
    const sold = 8000 + ((s + i * 53) % 5000);
    const rem = 4000 + ((s + i * 41) % 6000);
    const pnlUsd = -3200 + ((s + i * 311) % 9000);
    const invested = bought - rem * 0.4;
    const pnlPct = invested > 0 ? (pnlUsd / invested) * 100 : 0;
    const tok = DEMO_TOKENS[i % DEMO_TOKENS.length]!;
    const activity = ['9h', '3d', '11m', '2d'][i % 4]!;
    const bTxn = 1 + ((s + i * 3) % 28);
    const sTxn = 1 + ((s + i * 5) % 32);
    return {
      mint: tok.mint,
      symbol: tok.symbol,
      name: tok.name,
      imageUrl: null,
      decimals: 6,
      chain,
      boughtUsd: bought,
      boughtTokenUi: bought / 0.24,
      boughtTxnCount: bTxn,
      soldUsd: sold,
      soldTokenUi: sold / 0.23,
      soldTxnCount: sTxn,
      remainingUsd: rem,
      remainingTokenUi: rem / 0.25,
      pnlUsd,
      pnlPct,
      lastActivityLabel: activity,
    };
  };
  return [mk(0), mk(1), mk(2), mk(3)];
}

export type DemoActivityRow = {
  id: string;
  timeLabel: string;
  label: string;
  detail: string;
  tone: 'bull' | 'bear' | 'muted';
};

export function demoWalletActivityRows(walletAddress: string): DemoActivityRow[] {
  const s = seedNum(walletAddress);
  const base = [
    { label: 'Swap', detail: 'Jupiter · SOL → Token', tone: 'bull' as const },
    { label: 'Sell', detail: 'Pump · limit filled', tone: 'bear' as const },
    { label: 'Buy', detail: 'Market · increased position', tone: 'bull' as const },
    { label: 'Transfer', detail: 'CEX deposit rail', tone: 'muted' as const },
    { label: 'Stake', detail: 'Liquid staking deposit', tone: 'muted' as const },
  ];
  return base.map((r, i) => ({
    id: `demo-act-${walletAddress.slice(0, 6)}-${i}`,
    timeLabel: `${2 + ((s + i) % 55)}m ago`,
    ...r,
  }));
}

export type DemoTop100Row = {
  rank: number;
  label: string;
  volumeUsd: number;
  pnlUsd: number;
};

export function demoWalletTop100Rows(walletAddress: string): DemoTop100Row[] {
  const s = seedNum(walletAddress);
  return Array.from({ length: 12 }, (_, i) => ({
    rank: i + 1,
    label: `Trader ${((s + i * 17) % 900) + 100}`,
    volumeUsd: 890_000 - i * 62_000 + (s % 40_000),
    pnlUsd: -12_000 + ((s + i * 401) % 80_000),
  }));
}

export type DemoTransferRow = {
  id: string;
  dir: 'In' | 'Out';
  asset: string;
  amount: string;
  timeLabel: string;
};

export function demoWalletTransferRows(walletAddress: string): DemoTransferRow[] {
  const s = seedNum(walletAddress);
  return [
    {
      id: 'tr1',
      dir: 'In',
      asset: 'USDC',
      amount: `$${(4200 + (s % 2000)).toLocaleString()}`,
      timeLabel: '3h ago',
    },
    {
      id: 'tr2',
      dir: 'Out',
      asset: 'SOL',
      amount: `${(8 + (s % 12) / 10).toFixed(2)} SOL`,
      timeLabel: '1d ago',
    },
    {
      id: 'tr3',
      dir: 'In',
      asset: 'SOL',
      amount: `${(22 + (s % 30) / 10).toFixed(2)} SOL`,
      timeLabel: '4d ago',
    },
  ];
}
