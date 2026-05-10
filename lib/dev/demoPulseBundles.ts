import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  SOL_DEMO_CREATOR_WALLET,
  SOL_DEMO_MINT_BONK,
  SOL_DEMO_MINT_USDC,
  SOL_DEMO_MINT_WSOL,
} from '@/lib/utils/solDemoMints';
import {
  TON_DEMO_JETTON_A,
  TON_DEMO_JETTON_B,
  TON_NATIVE_UI_MINT,
} from '@/lib/utils/tonDemoMints';

function demoSnapshotId(mint: string): number {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = (Math.imul(h, 31) + mint.charCodeAt(i)) | 0;
  }
  return -100 - (Math.abs(h) % 900);
}

const now = () => new Date().toISOString();

function bundle(
  mint: string,
  symbol: string,
  name: string,
  launchPad: string | null,
  createdOffsetMin: number,
  mcUsd: number,
  volUsd: number,
  decimals = 9,
): PulseTokenBundle {
  const createdAt = new Date(Date.now() - createdOffsetMin * 60_000).toISOString();
  return {
    token: {
      mint,
      symbol,
      name,
      decimals,
      image_url: null,
      description: null,
      twitter_handle: null,
      telegram_url: null,
      website_url: null,
      creator_wallet: 'EQD0vdSA_NedY9wgmkLAtBZmRnYxlMJT0F2f5pTkOmXuTES',
      launch_pad: launchPad,
      raw_metadata: null,
      initial_liquidity_sol: 42,
      initial_liquidity_at: createdAt,
      migrated_at: null,
      mint_authority: null,
      freeze_authority: null,
      is_lp_locked: null,
      is_paid: null,
      created_at: createdAt,
      last_seen_at: now(),
    },
    snapshot: {
      id: demoSnapshotId(mint),
      mint,
      market_cap_usd: mcUsd,
      liquidity_usd: mcUsd * 0.08,
      price_usd: mcUsd > 1e6 ? 0.00042 : 0.0021,
      volume_5m_usd: volUsd * 0.2,
      volume_1h_usd: volUsd * 0.55,
      volume_24h_usd: volUsd,
      txns_5m: 12,
      txns_1h: 88,
      holder_count: 420 + Math.floor(mcUsd / 10_000),
      top10_holder_pct: 18.5,
      dev_holding_pct: 4.2,
      extended_metrics: null,
      snapshot_at: now(),
    },
  };
}

function solBundle(
  mint: string,
  symbol: string,
  name: string,
  launchPad: string | null,
  createdOffsetMin: number,
  mcUsd: number,
  volUsd: number,
  decimals = 9,
): PulseTokenBundle {
  const createdAt = new Date(Date.now() - createdOffsetMin * 60_000).toISOString();
  return {
    token: {
      mint,
      symbol,
      name,
      decimals,
      image_url: null,
      description: null,
      twitter_handle: null,
      telegram_url: null,
      website_url: null,
      creator_wallet: SOL_DEMO_CREATOR_WALLET,
      launch_pad: launchPad,
      raw_metadata: null,
      initial_liquidity_sol: 85,
      initial_liquidity_at: createdAt,
      migrated_at: null,
      mint_authority: null,
      freeze_authority: null,
      is_lp_locked: null,
      is_paid: null,
      created_at: createdAt,
      last_seen_at: now(),
    },
    snapshot: {
      id: demoSnapshotId(mint),
      mint,
      market_cap_usd: mcUsd,
      liquidity_usd: mcUsd * 0.08,
      price_usd: mcUsd > 1e6 ? 0.00042 : 0.0021,
      volume_5m_usd: volUsd * 0.2,
      volume_1h_usd: volUsd * 0.55,
      volume_24h_usd: volUsd,
      txns_5m: 12,
      txns_1h: 88,
      holder_count: 420 + Math.floor(mcUsd / 10_000),
      top10_holder_pct: 18.5,
      dev_holding_pct: 4.2,
      extended_metrics: null,
      snapshot_at: now(),
    },
  };
}

/** Feed rows when the Pulse API returns an empty list (UI demo mode only). */
export function syntheticPulseFeedItems(
  column: PulseColumnId,
  chain: AppChainId = 'ton',
): PulseTokenBundle[] {
  if (chain === 'sol') {
    const s1 = solBundle(
      SOL_DEMO_MINT_BONK,
      'BONK',
      'Bonk',
      'pump.fun',
      4,
      52_000_000,
      3_200_000,
      5,
    );
    const s2 = solBundle(
      SOL_DEMO_MINT_USDC,
      'USDC',
      'USD Coin',
      null,
      12,
      8_000_000_000,
      45_000_000,
      6,
    );
    const s3 = solBundle(
      SOL_DEMO_MINT_WSOL,
      'SOL',
      'Wrapped SOL',
      null,
      40,
      3_200_000_000_000,
      400_000_000,
      9,
    );
    if (column === 'new') return [s1, s2, s3];
    if (column === 'stretch') return [s2, s1];
    return [s3, s1, s2];
  }

  const b1 = bundle(
    TON_DEMO_JETTON_A,
    'USD₮',
    'Bridged stable',
    'dedust',
    8,
    2_400_000,
    180_000,
  );
  const b2 = bundle(
    TON_DEMO_JETTON_B,
    'WALL',
    'Watch wallet',
    null,
    200,
    12_000_000,
    4_000_000,
    6,
  );
  const b3 = bundle(
    TON_NATIVE_UI_MINT,
    'TON',
    'Native',
    null,
    120,
    8_500_000_000,
    900_000_000,
  );

  if (column === 'new') return [b1, b2, b3];
  if (column === 'stretch') return [b2, b1];
  return [b3, b1, b2];
}