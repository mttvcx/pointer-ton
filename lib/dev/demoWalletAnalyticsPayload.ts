import type { AppChainId } from '@/lib/chains/appChain';
import type {
  WalletAnalyticsPayload,
  WalletAnalyticsTimeframe,
  WinLossBucket,
} from '@/lib/wallet-analytics/types';
import { demoWalletPositions } from '@/lib/dev/demoWalletIntelRows';

function seedNum(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = Math.imul(31, h) + addr.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Synthetic wallet snapshot for early builds when `/api/wallet/.../analytics` is unavailable. */
export function buildDemoWalletAnalyticsPayload(
  address: string,
  chain: AppChainId,
  timeframe: WalletAnalyticsTimeframe,
): WalletAnalyticsPayload {
  const s = seedNum(`${address}:${timeframe}`);
  const now = Date.now();
  const totalPnl =
    timeframe === '1d'
      ? -1200 + (s % 8000)
      : timeframe === '7d'
        ? 3400 + (s % 12000)
        : timeframe === '30d'
          ? -8000 + (s % 25000)
          : 8900 + (s % 40000);
  const chart = Array.from({ length: 52 }, (_, i) => {
    const t = i / 51;
    const wave = Math.sin(t * Math.PI * 2.2) * 420;
    const drift = (t - 0.5) * Math.max(800, Math.abs(totalPnl) * 0.38);
    const noise = ((s + i * 17) % 180) - 90;
    return {
      t: now - (51 - i) * 3_600_000,
      v: Math.round(totalPnl * 0.72 + wave + drift + noise),
    };
  });

  const totalValueUsd = 84_000 + (s % 220_000);
  const unrealized = -18_000 + (s % 55_000);
  const tradeable = chain === 'sol' ? 4200 + (s % 8000) : null;
  const stable = 22_000 + (s % 40_000);

  const buckets: WinLossBucket[] = [
    { id: 'gt500', label: '>500%', count: 2 + (s % 4), tone: 'bull' },
    { id: '200to500', label: '200% ~ 500%', count: 6 + (s % 8), tone: 'bull' },
    { id: '0to200', label: '0% ~ 200%', count: 18 + (s % 20), tone: 'bull' },
    { id: '0toNeg50', label: '0% ~ -50%', count: 10 + (s % 12), tone: 'bear' },
    { id: 'ltNeg50', label: '< -50%', count: 4 + (s % 6), tone: 'bear' },
  ];

  return {
    address,
    chain,
    statsComputedAt: null,
    solLamports: chain === 'sol' ? String(6_200_000_000 + (s % 2_000_000_000)) : null,
    solUsd: chain === 'sol' ? tradeable : null,
    totalValueUsd,
    unrealizedPnlUsd: unrealized,
    tradeableBalanceUsd: tradeable,
    stableCoinBalanceUsd: stable,
    walletAgeLabel: chain === 'sol' ? `${6 + (s % 18)}mo` : null,
    nativeBalanceLabel: chain === 'ton' ? `${(45 + (s % 200) / 10).toFixed(2)} TON` : null,
    funding: null,
    chart,
    positions: demoWalletPositions(address, chain),
    performance: {
      totalPnlUsd: totalPnl,
      realizedPnlUsd: totalPnl * 0.38,
      txns: 28 + (s % 140),
      winRatePct: 32 + (s % 45),
    },
    buckets,
  };
}
