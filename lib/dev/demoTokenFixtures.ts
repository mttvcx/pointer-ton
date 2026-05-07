import type { Tables } from '@/lib/supabase/types';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import type { MintTopTraderRow, TraderMintHoverStats } from '@/lib/trading/mintTopTraders';

type TradeRow = Tables<'trades'>;

const DEMO_WALLETS = [
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'GThUX1Atox4Ykr68x6dzNChemUoK16z9bAQjyGQeM2dT',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB',
  '7K1WgKQgDzH9H3WR8QjmN8KqVn1YJgZxYzPLFToK9mNp',
] as const;

function isoMinsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

/** Activity tab: looks like real trades for layout tuning. */
export function syntheticTradesForMint(mint: string): TradeRow[] {
  const uid = '00000000-0000-4000-8000-0000000000demo';
  return [
    {
      id: 'demo-tx-1',
      user_id: uid,
      mint,
      side: 'buy',
      amount_in_raw: '1500000000',
      amount_out_raw: '4020000000000',
      amount_sol: 1.5,
      amount_token: 4020,
      price_usd_at_fill: 0.2314,
      tx_signature: '3demosig1111111111111111111111111111111111111111111111111111111111',
      fee_paid_lamports: 12_000,
      platform_fee_lamports: 2000,
      priority_fee_lamports: 5000,
      jito_tip_lamports: 0,
      status: 'confirmed',
      failure_reason: null,
      submitted_at: isoMinsAgo(4),
      confirmed_at: isoMinsAgo(3),
    },
    {
      id: 'demo-tx-2',
      user_id: uid,
      mint,
      side: 'sell',
      amount_in_raw: '800000000000',
      amount_out_raw: '480000000',
      amount_sol: 0.48,
      amount_token: 800,
      price_usd_at_fill: 0.2291,
      tx_signature: '3demosig2222222222222222222222222222222222222222222222222222222222',
      fee_paid_lamports: 9000,
      platform_fee_lamports: 1500,
      priority_fee_lamports: 4000,
      jito_tip_lamports: 0,
      status: 'confirmed',
      failure_reason: null,
      submitted_at: isoMinsAgo(14),
      confirmed_at: isoMinsAgo(14),
    },
    {
      id: 'demo-tx-3',
      user_id: uid,
      mint,
      side: 'buy',
      amount_in_raw: '5000000000',
      amount_out_raw: '12000000000000',
      amount_sol: 5,
      amount_token: 12000,
      price_usd_at_fill: 0.2389,
      tx_signature: '3demosig3333333333333333333333333333333333333333333333333333333333',
      fee_paid_lamports: 18_000,
      platform_fee_lamports: 5000,
      priority_fee_lamports: 12_000,
      jito_tip_lamports: 50_000,
      status: 'confirmed',
      failure_reason: null,
      submitted_at: isoMinsAgo(42),
      confirmed_at: isoMinsAgo(41),
    },
  ];
}

export function syntheticTopTradersForMint(mint: string): MintTopTraderRow[] {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = Math.imul(31, h) + mint.charCodeAt(i);
  }
  const skew = (Math.abs(h) % 500) / 100;
  return DEMO_WALLETS.map((w, i) => {
    const realized = 12400 - i * 2100 + skew * (i + 1);
    const buy_usd = 98967 + i * 12000 + skew * 100;
    const sell_usd = buy_usd + realized * 0.85;
    const buy_count = 1 + (i % 4);
    const sell_count = 2 + (i % 5);
    const buy_qty = 19_500_000 + i * 2_500_000;
    const sell_qty = 40_000_000 + i * 3_000_000;
    return {
      wallet_address: w,
      realized_pnl_usd: realized,
      win_rate: Math.min(0.92, 0.38 + i * 0.04 + skew * 0.01),
      trades: buy_count + sell_count + 2,
      buy_usd,
      sell_usd,
      buy_count,
      sell_count,
      buy_token_qty: buy_qty,
      sell_token_qty: sell_qty,
      avg_buy_usd_per_token: buy_usd / buy_qty,
      avg_sell_usd_per_token: sell_usd / sell_qty,
      first_trade_at: isoMinsAgo(120 - i * 8),
      last_trade_at: isoMinsAgo(12 - i),
      held_seconds: 46 + i * 371,
    };
  });
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
  const ranks = [1, 2, 3, 4, 5];
  const holders: HolderRow[] = ranks.map((rank, i) => ({
    id: -(100 + i),
    mint,
    wallet_address: DEMO_WALLETS[i]!,
    amount_raw: String(pow * BigInt(400 + i * 95)),
    pct_of_supply: 8.2 - i * 1.1,
    is_dev: i === 0,
    is_sniper: i === 2,
    rank,
    computed_at: isoMinsAgo(60),
  }));
  return { mint, decimals, holders };
}
