import type { Tables } from '@/lib/supabase/types';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import type { MintTopTraderRow, TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { formatCompactUsd } from '@/lib/utils/formatters';

type TradeRow = Tables<'trades'>;

const DEMO_WALLETS = [
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'GThUX1Atox4Ykr68x6dzNChemUoK16z9bAQjyGQeM2dT',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB',
  '7K1WgKQgDzH9H3WR8QjmN8KqVn1YJgZxYzPLFToK9mNp',
  'CkdZx6ewjY2vEYMbGmSCBkCZ27p5SKYreJTvfq9ngNMp',
  '8xhiPW6XGYzYSJ3D4S9gK8FJmQzHnM8vZ3Tt2V1WxYzAb',
  '4mNpQr5Ts6Uv7Wx8Yz9Ab0Cd1Ef2Gh3Ij4Kl5Mn6OpQr',
  'AbcdefGHij123456789JKLMnopqrstUVWXyzabcdefghijk',
  'VWXyzabcde123456789FGHijklmnopqrstuVWxyzabcdefghij',
  'NpQr5Ts6Uv7Wx8Yz9Ab0Cd1Ef2Gh3Ij4Kl5Mn6OpQr7St8U',
  'Mn6OpQr7St8Uv9Wx0Yz1Ab2Cd3Ef4Gh5Ij6Kl7Mn8Op9QrSt',
] as const;

/** Deterministic pseudo–base58 address for dense demo grids (layout only). */
export function demoWalletAt(i: number): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base = DEMO_WALLETS[i % DEMO_WALLETS.length]!;
  let out = '';
  for (let k = 0; k < 44; k++) {
    const idx = (i * 41 + k * 17 + base.charCodeAt(k % base.length)) % alphabet.length;
    out += alphabet[idx]!;
  }
  return out;
}

function isoMinsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function rng() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function relativeAgo(n: number, unit: 'd' | 'h' | 'm'): string {
  const mins = unit === 'd' ? n * 24 * 60 : unit === 'h' ? n * 60 : n;
  return isoMinsAgo(mins);
}

/** Activity tab: dense fills list for Axiom-style table typography tuning. */
export function syntheticTradesForMint(mint: string): TradeRow[] {
  const uid = '00000000-0000-4000-8000-0000000000demo';
  const rows: TradeRow[] = [];
  for (let i = 0; i < 40; i++) {
    const side = i % 5 === 0 ? 'sell' : 'buy';
    const sol = 0.08 + (i % 11) * 0.19 + (i % 3) * 0.05;
    const px = 0.18 + (i % 17) * 0.004 + (side === 'sell' ? -0.002 : 0.001);
    rows.push({
      id: `demo-tx-${i}`,
      user_id: uid,
      mint,
      side,
      amount_in_raw: String(1_500_000_000 + i * 33_000_000),
      amount_out_raw: String(4_020_000_000_000 + i * 120_000_000_000),
      amount_sol: Math.round(sol * 1000) / 1000,
      amount_token: 2000 + i * 420,
      price_usd_at_fill: Math.round(px * 10000) / 10000,
      tx_signature: `3demosig${String(i).padStart(3, '0')}111111111111111111111111111111111111111111111111111111111111`,
      fee_paid_lamports: 9000 + (i % 8) * 500,
      platform_fee_lamports: 1500,
      priority_fee_lamports: 4000 + (i % 5) * 600,
      jito_tip_lamports: i % 7 === 0 ? 25_000 : 0,
      status: 'confirmed',
      failure_reason: null,
      submitted_at: isoMinsAgo(i * 3 + 2),
      confirmed_at: isoMinsAgo(i * 3 + 1),
    });
  }
  return rows;
}

export function syntheticTopTradersForMint(mint: string): MintTopTraderRow[] {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = Math.imul(31, h) + mint.charCodeAt(i);
  }
  const skew = (Math.abs(h) % 500) / 100;
  const n = 24;
  const rows: MintTopTraderRow[] = [];
  for (let i = 0; i < n; i++) {
    const w = demoWalletAt(i);
    const realized = 18400 - i * 920 + skew * (i + 1) * 1.2;
    const buy_usd = 128_967 + i * 14_200 + skew * 140;
    const sell_usd = buy_usd + realized * 0.82;
    const buy_count = 1 + (i % 5);
    const sell_count = 2 + (i % 6);
    const buy_qty = 22_500_000 + i * 1_800_000;
    const sell_qty = 38_000_000 + i * 2_200_000;
    rows.push({
      wallet_address: w,
      realized_pnl_usd: realized,
      win_rate: Math.min(0.94, 0.36 + i * 0.018 + skew * 0.008),
      trades: buy_count + sell_count + 2 + (i % 3),
      buy_usd,
      sell_usd,
      buy_count,
      sell_count,
      buy_token_qty: buy_qty,
      sell_token_qty: sell_qty,
      avg_buy_usd_per_token: buy_usd / buy_qty,
      avg_sell_usd_per_token: sell_usd / sell_qty,
      first_trade_at: isoMinsAgo(400 - i * 14),
      last_trade_at: isoMinsAgo(90 - i * 2),
      held_seconds: 120 + i * 410,
    });
  }
  return rows;
}

/** Top-traders hover / wallet-on-mint modal when API has no rows yet. */
export function syntheticTraderMintStats(wallet: string): TraderMintHoverStats {
  let h = 0;
  for (let i = 0; i < wallet.length; i++) {
    h = Math.imul(31, h) + wallet.charCodeAt(i);
  }
  const skew = Math.abs(h % 100) / 50;
  return {
    buy_count: 3 + (Math.abs(h) % 4),
    sell_count: 5 + (Math.abs(h) % 3),
    buy_usd: 120 + skew * 20,
    sell_usd: 381 + skew * 30,
    realized_pnl_usd: 260 + skew * 10,
    win_rate: 0.55,
    first_trade_at: isoMinsAgo(16),
  };
}

/** Creator tab: full stats card in UI demo when indexer row is missing. */
export function syntheticCreatorDev(wallet: string): DevWalletStatsRow {
  return {
    wallet_address: wallet,
    tokens_launched: 14,
    tokens_mooned: 4,
    tokens_rugged: 1,
    tokens_active: 2,
    total_volume_generated_usd: 420_000,
    reputation_score: 72,
    median_time_to_rug_seconds: 3600 * 48,
    last_launch_at: isoMinsAgo(120),
    computed_at: isoMinsAgo(5),
  };
}

type HolderRow = {
  id: number;
  mint: string;
  wallet_address: string;
  amount_raw: string;
  pct_of_supply: number | null;
  is_dev: boolean | null;
  is_sniper: boolean | null;
  rank: number | null;
  computed_at: string;
};

export type HoldersApiShape = {
  mint: string;
  decimals: number;
  holders: HolderRow[];
};

/** Deterministic V/MC for Pulse rows when UI demo fills empty snapshots. */
export function syntheticPulseVolMc(mint: string): { volUsd: number; mcUsd: number } {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = Math.imul(31, h) + mint.charCodeAt(i);
  }
  const u = Math.abs(h);
  const volUsd = 14_000 + (u % 800) * 120;
  const mcUsd = 9_500 + (u % 500) * 140;
  return { volUsd, mcUsd };
}

export function syntheticHoldersResponse(mint: string, decimals: number): HoldersApiShape {
  const pow = BigInt(10) ** BigInt(Math.min(Math.max(decimals, 0), 12));
  const count = 22;
  const holders: HolderRow[] = [];
  for (let i = 0; i < count; i++) {
    const rank = i + 1;
    holders.push({
      id: -(200 + i),
      mint,
      wallet_address: demoWalletAt(i + 3),
      amount_raw: String(pow * BigInt(520 - i * 18 + ((i * 17) % 40))),
      pct_of_supply: Math.max(0.12, 12.4 - i * 0.55 - (i % 4) * 0.12),
      is_dev: i === 0,
      is_sniper: i === 3 || i === 8,
      rank,
      computed_at: isoMinsAgo(40 + i),
    });
  }
  return { mint, decimals, holders };
}

/** Token info grid / buy panel when extended-metrics API is quiet. */
export function syntheticTokenExtendedMetrics(mint: string): TokenExtendedMetrics {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = Math.imul(31, h) + mint.charCodeAt(i);
  }
  const u = Math.abs(h);
  return {
    top10HolderPct: 14 + (u % 12),
    devHoldingPct: 2.5 + (u % 8),
    sniperHolderPct: 4 + (u % 6),
    insidersPct: 1.2 + (u % 4),
    bundlersPct: 8 + (u % 10),
    lpBurnedPct: u % 3 === 0 ? 100 : 0,
    holders: 420 + (u % 2400),
    proTraders: 12 + (u % 40),
    dexPaid: u % 5 === 0,
    vol6hUsd: 180_000 + (u % 900) * 420,
    buys6h: 120 + (u % 280),
    sells6h: 80 + (u % 160),
    buyVol6hUsd: 110_000 + (u % 400) * 220,
    sellVol6hUsd: 70_000 + (u % 300) * 180,
    netVol6hUsd: 40_000 + (u % 200) * 120,
    taxPct: u % 4 === 1 ? 0.25 : u % 11 === 0 ? 1.2 : null,
  };
}

export type SyntheticPositionRow = {
  token: string;
  boughtUsd: number;
  soldUsd: number;
  remainingUsd: number;
  pnlUsd: number;
};

export function syntheticPositionsForMint(sym: string, mint: string): SyntheticPositionRow[] {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = Math.imul(31, h) + mint.charCodeAt(i);
  }
  const skew = Math.abs(h % 50) / 10;
  return Array.from({ length: 8 }, (_, i) => {
    const bought = 840 + i * 420 + skew * 40;
    const sold = i < 3 ? bought * 0.35 : bought * 0.62;
    const remaining = Math.max(0, bought - sold * 0.88);
    const pnl = sold - bought * 0.52 + (i % 2 === 0 ? 120 : -80);
    return { token: sym, boughtUsd: bought, soldUsd: sold, remainingUsd: remaining, pnlUsd: pnl };
  });
}

export type SyntheticDevTokenRow = {
  mint: string;
  symbol: string;
  name: string;
  mcUsd: number;
  athUsd: number;
  liquidityUsd: number;
  volume1hUsd: number;
  balanceUsd: number;
  pnlUsd: number;
  migrated: boolean;
  dex: string | null;
  status: 'active' | 'mooned' | 'rugged';
  launchedAt: string;
};

export function syntheticDevTokensForCreator(
  creatorWallet: string,
  currentMint: string,
): SyntheticDevTokenRow[] {
  const seed = simpleHash(creatorWallet);
  const rng = mulberry32(seed);

  const baseSymbols = ['PEPE2', 'RUGCAT', 'MOONX', 'DEVTEST', 'BONKJR', 'PUMPIT', 'GRAIL', 'SENDIT'];
  const statuses: SyntheticDevTokenRow['status'][] = [
    'active',
    'mooned',
    'rugged',
    'active',
    'mooned',
    'active',
    'rugged',
    'active',
  ];
  const dexes: (string | null)[] = [
    'raydium',
    'meteora',
    'raydium',
    null,
    'raydium',
    'meteora',
    null,
    'raydium',
  ];

  return baseSymbols.map((symbol, i) => {
    const mcUsd = Math.round((42 + i * 80 + rng() * 50) * 1000);
    const athMultiplier = 1.4 + rng() * 3.2;
    const athUsd = Math.round(mcUsd * athMultiplier);
    const liquidityUsd = Math.round(mcUsd * (0.05 + rng() * 0.15));
    const volume1hUsd = Math.round(mcUsd * (0.02 + rng() * 0.4));
    const balanceUsd = Math.round(mcUsd * (0.001 + rng() * 0.15));
    const pnlUsd = Math.round((rng() - 0.3) * mcUsd * 0.5);
    const status = statuses[i]!;
    const migrated = status === 'mooned' || (status === 'active' && rng() > 0.4);
    const dex = migrated ? dexes[i] ?? null : null;

    return {
      mint: i === 0 ? currentMint : `${currentMint.slice(0, 6)}_${symbol}`,
      symbol,
      name: `${symbol} demo`,
      mcUsd,
      athUsd,
      liquidityUsd,
      volume1hUsd,
      balanceUsd,
      pnlUsd,
      migrated,
      dex,
      status,
      launchedAt: relativeAgo(2 + i, 'd'),
    };
  });
}

/** Format helper for positions desk demo cells. */
export function formatDemoPositionUsd(n: number): string {
  return formatCompactUsd(n);
}
