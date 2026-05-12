import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';
import { dexScreenerTokenIconUrl } from '@/lib/explore/demoTokenIcons';
import type { PulseTokenBundle, TokenRow } from '@/types/tokens';
import {
  SOL_DEMO_CREATOR_WALLET,
  SOL_DEMO_MINT_BOME,
  SOL_DEMO_MINT_BONK,
  SOL_DEMO_MINT_JUP,
  SOL_DEMO_MINT_MSOL,
  SOL_DEMO_MINT_ORCA,
  SOL_DEMO_MINT_POPCAT,
  SOL_DEMO_MINT_RAY,
  SOL_DEMO_MINT_USDC,
  SOL_DEMO_MINT_WIF,
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

type SolBundleOpts = Omit<Partial<TokenRow>, 'decimals'> & { decimals?: number };

function solBundle(
  mint: string,
  symbol: string,
  name: string,
  launchPad: string | null,
  createdOffsetMin: number,
  mcUsd: number,
  volUsd: number,
  opts?: SolBundleOpts,
): PulseTokenBundle {
  const createdAt = new Date(Date.now() - createdOffsetMin * 60_000).toISOString();
  const decimals = opts?.decimals ?? 9;
  const { decimals: _dec, ...tokenExtra } = opts ?? {};
  void _dec;
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
      ...tokenExtra,
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
    const s1 = solBundle(SOL_DEMO_MINT_BONK, 'BONK', 'Bonk', 'pump.fun', 4, 52_000_000, 3_200_000, {
      decimals: 5,
    });
    const s2 = solBundle(SOL_DEMO_MINT_USDC, 'USDC', 'USD Coin', null, 12, 8_000_000_000, 45_000_000, {
      decimals: 6,
    });
    const s3 = solBundle(SOL_DEMO_MINT_WSOL, 'SOL', 'Wrapped SOL', null, 40, 3_200_000_000_000, 400_000_000, {
      decimals: 9,
    });
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

const EVM_DEMO_CREATOR = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

/** Lowecase ERC-20-shaped ids so routing stays forgiving while still unique per token. */
type EvmBundleOpts = SolBundleOpts;

function evmBundle(
  mint: string,
  symbol: string,
  name: string,
  launchPad: string | null,
  createdOffsetMin: number,
  mcUsd: number,
  volUsd: number,
  opts?: EvmBundleOpts,
): PulseTokenBundle {
  const createdAt = new Date(Date.now() - createdOffsetMin * 60_000).toISOString();
  const decimals = opts?.decimals ?? 18;
  const { decimals: _d, ...tokenExtra } = opts ?? {};
  void _d;
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
      creator_wallet: EVM_DEMO_CREATOR,
      launch_pad: launchPad,
      raw_metadata: null,
      initial_liquidity_sol: null,
      initial_liquidity_at: createdAt,
      migrated_at: null,
      mint_authority: null,
      freeze_authority: null,
      is_lp_locked: null,
      is_paid: null,
      created_at: createdAt,
      last_seen_at: now(),
      ...tokenExtra,
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

function exploreIcon(chain: AppChainId, mint: string): Pick<TokenRow, 'image_url'> | undefined {
  const u = dexScreenerTokenIconUrl(chain, mint);
  return u ? { image_url: u } : undefined;
}

/** Rich bubbles when Explore returns no rows (dev / UI demo / ?explore_demo=1 only). */
export function syntheticExploreDemoBundles(chain: AppChainId): PulseTokenBundle[] {
  if (chain === 'sol') {
    return [
      solBundle(SOL_DEMO_MINT_WSOL, 'SOL', 'Wrapped SOL', null, 200, 28_000_000_000, 780_000_000, {
        ...exploreIcon('sol', SOL_DEMO_MINT_WSOL),
      }),
      solBundle(SOL_DEMO_MINT_USDC, 'USDC', 'USD Coin', null, 60, 9_800_000_000, 120_000_000, {
        decimals: 6,
        website_url: 'https://www.circle.com/en/usdc',
        ...exploreIcon('sol', SOL_DEMO_MINT_USDC),
      }),
      solBundle(SOL_DEMO_MINT_JUP, 'JUP', 'Jupiter', null, 18, 1_950_000_000, 95_000_000, {
        twitter_handle: 'JupiterExchange',
        website_url: 'https://jup.ag',
        ...exploreIcon('sol', SOL_DEMO_MINT_JUP),
      }),
      solBundle(SOL_DEMO_MINT_WIF, 'WIF', 'dogwifhat', 'meteora', 25, 1_820_000_000, 140_000_000, {
        twitter_handle: 'dogwifcoin',
        website_url: 'https://dogwifcoin.org',
        ...exploreIcon('sol', SOL_DEMO_MINT_WIF),
      }),
      solBundle(SOL_DEMO_MINT_BONK, 'BONK', 'Bonk', 'pump.fun', 8, 1_680_000_000, 88_000_000, {
        decimals: 5,
        twitter_handle: 'bonk_inu',
        website_url: 'https://bonkcoin.com',
        ...exploreIcon('sol', SOL_DEMO_MINT_BONK),
      }),
      solBundle(SOL_DEMO_MINT_ORCA, 'ORCA', 'Orca', null, 90, 240_000_000, 12_600_000, {
        website_url: 'https://orca.so',
        ...exploreIcon('sol', SOL_DEMO_MINT_ORCA),
      }),
      solBundle(SOL_DEMO_MINT_RAY, 'RAY', 'Raydium', null, 70, 1_920_000_000, 64_000_000, {
        website_url: 'https://raydium.io/',
        ...exploreIcon('sol', SOL_DEMO_MINT_RAY),
      }),
      solBundle(SOL_DEMO_MINT_MSOL, 'MSOL', 'Marinade staked SOL', null, 400, 1_820_000_000, 6_600_000, {
        website_url: 'https://marinade.finance/',
        ...exploreIcon('sol', SOL_DEMO_MINT_MSOL),
      }),
      solBundle(SOL_DEMO_MINT_BOME, 'BOME', 'BOOK OF MEME', 'pump.fun', 12, 480_000_000, 35_000_000, {
        twitter_handle: 'darkfarms1',
        ...exploreIcon('sol', SOL_DEMO_MINT_BOME),
      }),
      solBundle(SOL_DEMO_MINT_POPCAT, 'POPCAT', 'Popcat', 'pump.fun', 140, 220_000_000, 9_900_000, {
        ...exploreIcon('sol', SOL_DEMO_MINT_POPCAT),
      }),
    ];
  }

  if (chain === 'bnb') {
    return [
      evmBundle('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', 'WBNB', 'Wrapped BNB', null, 820, 4_900_000_000, 190_000_000, {
        ...exploreIcon('bnb', '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'),
      }),
      evmBundle('0x55d398326f99059ff775485246999027b3197955', 'USDT', 'Tether USD', null, 60, 8_900_000_000, 3_900_000_000, {
        decimals: 18,
        ...exploreIcon('bnb', '0x55d398326f99059ff775485246999027b3197955'),
      }),
      evmBundle('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'USDC', 'USD Coin', null, 140, 1_920_000_000, 280_000_000, {
        decimals: 18,
        website_url: 'https://www.circle.com/',
        ...exploreIcon('bnb', '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'),
      }),
      evmBundle('0x0e09fabbb73bd3ade0a17ecc321fd13a19e81ce82', 'CAKE', 'PancakeSwap', null, 48, 1_620_000_000, 44_000_000, {
        twitter_handle: 'PancakeSwap',
        website_url: 'https://pancakeswap.finance/',
        ...exploreIcon('bnb', '0x0e09fabbb73bd3ade0a17ecc321fd13a19e81ce82'),
      }),
      evmBundle('0x2170ed0880ac9a755fd29b2688956bd959f933f8', 'ETH', 'Ethereum (BSC)', null, 300, 1_980_000_000, 520_000_000, {
        ...exploreIcon('bnb', '0x2170ed0880ac9a755fd29b2688956bd959f933f8'),
      }),
      evmBundle('0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', 'BTCB', 'Bitcoin BEP2', null, 400, 6_900_000_000, 120_000_000, {
        decimals: 18,
        ...exploreIcon('bnb', '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'),
      }),
    ];
  }

  if (chain === 'base') {
    return [
      evmBundle('0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', null, 1200, 1_980_000_000_000, 420_000_000, {
        ...exploreIcon('base', '0x4200000000000000000000000000000000000006'),
      }),
      evmBundle('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'USDC', 'USD Base Coin', null, 80, 2_820_000_000, 120_000_000, {
        decimals: 6,
        website_url: 'https://www.circle.com/',
        ...exploreIcon('base', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
      }),
      evmBundle('0x4ed4e862860bed51a9570b96d89af5e1b0efefed', 'DEGEN', 'Degen', 'zora', 20, 260_000_000, 19_600_000, {
        twitter_handle: 'degentokenbase',
        website_url: 'https://degentoken.site/',
        ...exploreIcon('base', '0x4ed4e862860bed51a9570b96d89af5e1b0efefed'),
      }),
      evmBundle('0x940181a94a35a3369ea44939cd763240b51f8314', 'AERO', 'Aerodrome Finance', null, 55, 620_000_000, 12_900_000, {
        website_url: 'https://aerodrome.finance/',
        ...exploreIcon('base', '0x940181a94a35a3369ea44939cd763240b51f8314'),
      }),
      evmBundle('0xb6fe221fe93eef5633414902edc08965027766584', 'BRETT', 'Brett', 'pump', 30, 120_000_000, 5_900_000, {
        website_url: 'https://paragraph.com/',
        ...exploreIcon('base', '0xb6fe221fe93eef5633414902edc08965027766584'),
      }),
    ];
  }

  const bStable = bundle(
    TON_DEMO_JETTON_A,
    'USD₮',
    'Bridged stable',
    'dedust',
    8,
    2_400_000,
    180_000,
  );
  const bWal = bundle(
    TON_DEMO_JETTON_B,
    'WALL',
    'Watch wallet',
    null,
    200,
    12_000_000,
    4_000_000,
    6,
  );
  const bTon = bundle(
    TON_NATIVE_UI_MINT,
    'TON',
    'Toncoin',
    null,
    360,
    8_900_000_000,
    930_000_000,
  );
  return [bTon, bWal, bStable];
}