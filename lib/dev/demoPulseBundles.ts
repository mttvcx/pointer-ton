import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';
import { HYPE_MINT } from '@/lib/utils/constants';
import { USDC_MINT } from '@/lib/utils/addresses';

/** Placeholder “mint” string for UI demo native TON row (not a jetton master). */
const TON_NATIVE_DEMO_MINT = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

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
      id:
        mint === HYPE_MINT ? -101 : mint === USDC_MINT ? -102 : mint === TON_NATIVE_DEMO_MINT ? -103 : -104,
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
export function syntheticPulseFeedItems(column: PulseColumnId): PulseTokenBundle[] {
  const b1 = bundle(
    HYPE_MINT,
    'HYPE',
    'Demo listed',
    'dedust',
    8,
    2_400_000,
    180_000,
  );
  const b2 = bundle(
    USDC_MINT,
    'USDC',
    'Demo stable',
    null,
    200,
    12_000_000_000,
    4_000_000_000,
    6,
  );
  const b3 = bundle(
    TON_NATIVE_DEMO_MINT,
    'TON',
    'Demo native',
    null,
    120,
    8_500_000_000,
    900_000_000,
  );

  if (column === 'new') return [b1, b2, b3];
  if (column === 'stretch') return [b2, b1];
  return [b3, b1, b2];
}