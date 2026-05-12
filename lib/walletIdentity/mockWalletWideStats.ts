/** Deterministic mock wallet‑wide aggregates (until analytics API lands). */

export interface MockWideStatsShape {
  pnl7dUsd: number;
  pnl30dUsd: number;
  winRate7d: number;
  tokenCount7d: number;
  txBuy7d: number;
  txSell7d: number;
  avgDuration7dHours: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  trackedByCount: number;
  renamedByCount: number;
  walletAgeDays: number | null;
}

export function mockWalletWideStats(address: string): MockWideStatsShape {
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = Math.abs(h);
  const sign = u % 5 === 0 ? -1 : 1;
  const base = (u % 9000) / 10;
  return {
    pnl7dUsd: sign * base * (1 + (u % 7)),
    pnl30dUsd: sign * base * (2 + (u % 5)),
    winRate7d: 35 + (u % 50),
    tokenCount7d: 3 + (u % 14),
    txBuy7d: 4 + (u % 21),
    txSell7d: 3 + (u % 18),
    avgDuration7dHours: 2 + (u % 72),
    totalVolumeUsd: 12_000 + (u % 800) * 120,
    totalFeesUsd: 8 + (u % 220) / 10,
    trackedByCount: u % 9,
    renamedByCount: u % 4,
    walletAgeDays: 20 + (u % 600),
  };
}
