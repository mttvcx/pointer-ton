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
import { USDC_MINT } from '@/lib/utils/addresses';
import {
  TON_DEMO_JETTON_A,
  TON_DEMO_JETTON_B,
  TON_DEMO_JETTON_C,
  TON_DEMO_JETTON_D,
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
      migrated_to: null,
      bonding_progress: null,
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
      holder_count: Math.min(5_400, 420 + Math.floor(mcUsd / 1_500_000)),
      top10_holder_pct: 18.5,
      dev_holding_pct: 4.2,
      extended_metrics: null,
      snapshot_at: now(),
    },
  };
}

type SolBundleOpts = Omit<Partial<TokenRow>, 'decimals'> & {
  decimals?: number;
  /** Merge into synthetic snapshot rows (Pulse demo fills). */
  snapshotPatch?: Partial<NonNullable<PulseTokenBundle['snapshot']>>;
};

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
  const { decimals: _dec, snapshotPatch, ...tokenExtra } = opts ?? {};
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
      migrated_to: null,
      bonding_progress: null,
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
      /** Capped: hundreds-of-millions synthetic holders read as "glitched" on Pulse. */
      holder_count: Math.min(6_400, 420 + Math.floor(mcUsd / 1_500_000)),
      top10_holder_pct: 18.5,
      dev_holding_pct: 4.2,
      extended_metrics: null,
      snapshot_at: now(),
      ...(snapshotPatch ?? {}),
    },
  };
}

/** Clone a demo bundle with a specific bonding-curve fill % (stretch column QA). */
function withBondingProgress(bundleRow: PulseTokenBundle, f: number): PulseTokenBundle {
  const tokenMeta =
    bundleRow.token.raw_metadata && typeof bundleRow.token.raw_metadata === 'object'
      ? (bundleRow.token.raw_metadata as Record<string, unknown>)
      : {};
  const snapMeta =
    bundleRow.snapshot?.extended_metrics && typeof bundleRow.snapshot.extended_metrics === 'object'
      ? (bundleRow.snapshot.extended_metrics as Record<string, unknown>)
      : {};
  return {
    ...bundleRow,
    token: {
      ...bundleRow.token,
      raw_metadata: { ...tokenMeta, F: f, bondingCurveProgress: f },
    },
    snapshot: bundleRow.snapshot
      ? {
          ...bundleRow.snapshot,
          extended_metrics: { ...snapMeta, F: f },
        }
      : bundleRow.snapshot,
  };
}

/** Feed rows when the Pulse API returns an empty list (UI demo mode only). */
export function syntheticPulseFeedItems(
  column: PulseColumnId,
  chain: AppChainId = 'ton',
): PulseTokenBundle[] {
  if (chain === 'sol') {
    const sRay = solBundle(SOL_DEMO_MINT_RAY, 'GDOR', 'Global Digital Oil', 'raydium', 0.12, 1_100, 310, {
      raw_metadata: { poolType: 'raydium-clmm', F: 38, bondingCurveProgress: 38 },
      snapshotPatch: { extended_metrics: { F: 38, protocol: 'raydium-clmm' }, txns_1h: 18 },
    });
    const sLaunchlab = solBundle(SOL_DEMO_MINT_POPCAT, 'RACCOON', 'RACCOON', 'launchlab', 12, 999, 0, {
      decimals: 5,
      raw_metadata: {
        programId: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
        source: 'raydium launchlab',
        F: 0,
        bondingCurveProgress: 0,
      },
      snapshotPatch: {
        extended_metrics: { F: 0, protocol: 'launchlab', quoteSymbol: 'SOL' },
        txns_1h: 1,
        holder_count: 0,
      },
    });
    const sOrca = solBundle(SOL_DEMO_MINT_ORCA, 'BUTTCOIN', 'Buttcoin', 'orca', 7, 12_000, 890, {
      raw_metadata: {
        source: 'orca.so/wavebreak',
        poolType: 'wavebreak',
        F: 8,
        bondingCurveProgress: 8,
      },
      snapshotPatch: {
        extended_metrics: { F: 8, protocol: 'wavebreak', quoteSymbol: 'SOL' },
        txns_1h: 6,
        holder_count: 4,
      },
    });
    const sMeteora = solBundle(SOL_DEMO_MINT_WIF, 'JAIL', 'JAIL', 'meteora', 0.75, 8_500, 420, {
      raw_metadata: {
        poolType: 'damm-v2',
        source: 'meteora amm v2',
        F: 12,
        bondingCurveProgress: 12,
      },
      snapshotPatch: {
        extended_metrics: { F: 12, protocol: 'meteora-amm-v2', quoteSymbol: 'SOL' },
        txns_1h: 5,
        holder_count: 2,
      },
    });
    const sMayhem = solBundle(SOL_DEMO_MINT_WIF, 'LOSE', 'Mayhem fresh demo', 'mayhem', 0.38, 1_890, 22, {
      raw_metadata: { mayhemMode: true, isMayhemMode: true, F: 2.49 },
      snapshotPatch: { extended_metrics: { mayhemMode: true, F: 2.49 }, txns_1h: 7 },
    });
    const sMoonshot = solBundle(SOL_DEMO_MINT_POPCAT, 'JAILED', 'JAILED', 'moonshot', 2 * 60, 3_500, 420, {
      raw_metadata: {
        programId: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
        source: 'moonshot',
        F: 12,
        bondingCurveProgress: 12,
      },
      snapshotPatch: { extended_metrics: { F: 12, quoteSymbol: 'SOL' }, txns_1h: 5, holder_count: 2 },
    });
    const sMoonit = solBundle(SOL_DEMO_MINT_ORCA, 'DERP', 'Derp', 'moonit', 0.5, 4_200, 380, {
      raw_metadata: {
        programId: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
        source: 'moon.it',
        F: 0.02,
        bondingCurveProgress: 0.02,
      },
      snapshotPatch: { extended_metrics: { F: 0.02, quoteSymbol: 'SOL' }, txns_1h: 3, holder_count: 1 },
    });
    const sMoonit2 = solBundle(SOL_DEMO_MINT_MSOL, 'MEME', 'Memecoin', 'moonit', 0.75, 3_800, 290, {
      raw_metadata: {
        source: 'moon.it',
        F: 0.05,
        bondingCurveProgress: 0.05,
      },
      snapshotPatch: { extended_metrics: { F: 0.05, quoteSymbol: 'SOL' }, txns_1h: 2, holder_count: 0 },
    });
    const sMoonit3 = solBundle(SOL_DEMO_MINT_WSOL, 'HD', 'si senor', 'moonit', 1.2, 5_600, 510, {
      raw_metadata: {
        source: 'moon.it',
        F: 0.08,
        bondingCurveProgress: 0.08,
      },
      snapshotPatch: { extended_metrics: { F: 0.08, quoteSymbol: 'SOL' }, txns_1h: 4, holder_count: 2 },
    });
    const sJupStudio = solBundle(SOL_DEMO_MINT_BONK, 'RFFT', 'Rocket Fart Fuel', 'jupiter-studio', 10, 6_800, 620, {
      decimals: 5,
      raw_metadata: {
        source: 'studio.jup.ag',
        poolType: 'jupiter-studio',
        F: 0.6,
        bondingCurveProgress: 0.6,
      },
      snapshotPatch: {
        extended_metrics: { F: 0.6, protocol: 'jupiter-studio', quoteSymbol: 'SOL' },
        txns_1h: 8,
        holder_count: 3,
      },
    });
    const sJupStudio2 = solBundle(SOL_DEMO_MINT_USDC, 'USDC', 'USDC on Studio', 'jupiter-studio', 12, 4_200, 410, {
      decimals: 6,
      raw_metadata: {
        source: 'studio.jup.ag',
        F: 1.4,
        bondingCurveProgress: 1.4,
      },
      snapshotPatch: { extended_metrics: { F: 1.4, quoteSymbol: 'SOL' }, txns_1h: 5, holder_count: 2 },
    });
    const sDynamicBc = solBundle(SOL_DEMO_MINT_RAY, 'ARIA', 'ARIA', 'dynamic-bc', 0.2, 5_010, 543, {
      raw_metadata: {
        poolType: 'dynamic-bonding-curve',
        source: 'meteora-dbc',
        F: 3.6,
        bondingCurveProgress: 3.6,
      },
      snapshotPatch: {
        extended_metrics: { F: 3.6, protocol: 'dynamic-bonding-curve', quoteSymbol: 'SOL' },
        txns_1h: 4,
        holder_count: 1,
      },
    });
    const sDynamicBc2 = solBundle(SOL_DEMO_MINT_WIF, 'CLAWFY', 'Clawfy', 'dynamic-bc', 1, 8_200, 890, {
      twitter_handle: 'https://x.com/Clawfy_io',
      raw_metadata: {
        poolType: 'meteora-dbc',
        F: 18,
        bondingCurveProgress: 18,
      },
      snapshotPatch: { extended_metrics: { F: 18, quoteSymbol: 'SOL' }, txns_1h: 12, holder_count: 4 },
    });
    const sDaos = solBundle(SOL_DEMO_MINT_BONK, 'GLM', 'Goblina Language Model', 'daos.fun', 24 * 60, 2_590, 0, {
      decimals: 5,
      raw_metadata: { source: 'daos.fun', F: 0, bondingCurveProgress: 0 },
      snapshotPatch: { extended_metrics: { F: 0, quoteSymbol: 'SOL' }, txns_1h: 1, holder_count: 0 },
    });
    const sDaos2 = solBundle(SOL_DEMO_MINT_USDC, 'SLM', 'Sydney Language Model', 'daos.fun', 24 * 60, 2_590, 2_000, {
      decimals: 6,
      twitter_handle: 'https://x.com/Polymarket',
      raw_metadata: { source: 'daos.fun', F: 0.14, bondingCurveProgress: 0.14 },
      snapshotPatch: { extended_metrics: { F: 0.14, quoteSymbol: 'SOL' }, txns_1h: 12, holder_count: 0 },
    });
    const sDaos3 = solBundle(SOL_DEMO_MINT_JUP, 'vril', 'vril', 'daos.fun', 24 * 60, 6_140, 11_000, {
      twitter_handle: 'https://x.com/vrilpeptides',
      raw_metadata: { source: 'daos.fun', F: 42, bondingCurveProgress: 42 },
      snapshotPatch: { extended_metrics: { F: 42, quoteSymbol: 'SOL' }, txns_1h: 177, holder_count: 22 },
    });
    const sPump = solBundle(SOL_DEMO_MINT_POPCAT, 'POP', 'Popcat', 'pump.fun', 2, 220_000_000, 9_900_000, {
      decimals: 5,
      raw_metadata: { F: 17.37, bondingCurveProgress: 17.37 },
      snapshotPatch: { extended_metrics: { F: 17.37 } },
    });
    /** Pump.fun USDC pair — quote badge beside age (Axiom-style). */
    const sPumpUsdc = solBundle(SOL_DEMO_MINT_WIF, 'PEEPEE', 'Dr. Peepee', 'pump.fun', 0.05, 4_220, 118, {
      raw_metadata: {
        F: 3.57,
        bondingCurveProgress: 3.57,
        quoteMint: USDC_MINT,
        source: 'pump.fun',
      },
      snapshotPatch: {
        extended_metrics: { F: 3.57, quoteSymbol: 'USDC', quoteMint: USDC_MINT },
        txns_1h: 3,
        holder_count: 1,
      },
    });
    const sPumpUsdc2 = solBundle(SOL_DEMO_MINT_BOME, 'PEPE', 'Pepe on Pump USDC', 'pump.fun', 0.45, 3_530, 1_000, {
      raw_metadata: {
        F: 8.2,
        bondingCurveProgress: 8.2,
        quoteMint: USDC_MINT,
      },
      snapshotPatch: {
        extended_metrics: { quoteSymbol: 'USDC' },
        txns_1h: 2,
        holder_count: 0,
      },
    });
    const sPumpSol = solBundle(SOL_DEMO_MINT_JUP, 'PEEPEE', 'PEEPEE', 'pump.fun', 0.25, 3_800, 890, {
      raw_metadata: { F: 6.1, bondingCurveProgress: 6.1 },
      snapshotPatch: { extended_metrics: { F: 6.1, quoteSymbol: 'SOL' }, txns_1h: 1, holder_count: 0 },
    });
    const sBonk = solBundle(SOL_DEMO_MINT_BONK, 'BONK', 'Bonk', 'bonk', 4, 52_000_000, 3_200_000, {
      decimals: 5,
      twitter_handle: 'https://x.com/elonmusk',
    });
    const sBags = solBundle(SOL_DEMO_MINT_BOME, 'UNICLAW', 'Uniclaws', 'bags', 0.35, 180_000, 22, {
      raw_metadata: {
        programId: 'BSfTAhiifGCG9wftxQp7DjPkBkwjFxNsoEjr3iJYhyR8',
        source: 'bags.fm',
        F: 15,
        bondingCurveProgress: 15,
      },
      snapshotPatch: { extended_metrics: { F: 15 }, txns_1h: 7 },
    });
    const sPrintr = solBundle(SOL_DEMO_MINT_JUP, 'SHOCRR', 'SHOCKRR on PRINTR', 'printr', 1.2, 6_010, 310, {
      raw_metadata: {
        source: 'printr',
        programId: 'Pr1NTtR67xZJaR5JG7nT4CMhGwDFqpzN5JhtXXn8nEM',
        F: 22,
        bondingCurveProgress: 22,
      },
      snapshotPatch: { extended_metrics: { F: 22, quoteSymbol: 'SOL' }, txns_1h: 9 },
    });
    const sSoar = solBundle(SOL_DEMO_MINT_MSOL, 'LIFT', 'Lift on Soar', 'soar', 0.9, 4_200, 180, {
      raw_metadata: {
        source: 'launchonsoar',
        F: 31,
        bondingCurveProgress: 31,
      },
      snapshotPatch: { extended_metrics: { F: 31, quoteSymbol: 'SOL' }, txns_1h: 11 },
    });
    const sSurge = solBundle(SOL_DEMO_MINT_USDC, 'AA', 'a a', 'surge', 18 * 60, 2_300, 187, {
      decimals: 6,
      raw_metadata: {
        source: 'surge.xyz',
        F: 1.2,
        bondingCurveProgress: 1.2,
      },
      snapshotPatch: {
        extended_metrics: { F: 1.2, quoteSymbol: 'SOL' },
        txns_1h: 12,
        holder_count: 1,
      },
    });
    const sUsd1 = solBundle(SOL_DEMO_MINT_RAY, 'USD1X', 'USD1 pair demo', 'pump.fun', 3, 42_000_000, 2_400_000, {
      raw_metadata: { pointerIngestSource: 'helius_webhook', quoteMint: 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB' },
      snapshotPatch: { extended_metrics: { quoteSymbol: 'USD1', pro_traders: 18 } },
    });
    const sHeaven = solBundle(SOL_DEMO_MINT_ORCA, 'ASCND', 'ascend', 'heaven', 19 * 60, 3_030, 5_000, {
      twitter_handle: 'https://x.com/ascendonheaven',
      raw_metadata: {
        launchpad: 'heaven.xyz',
        source: 'heaven.xyz',
        F: 5.6,
        bondingCurveProgress: 5.6,
      },
      snapshotPatch: { extended_metrics: { F: 5.6, quoteSymbol: 'SOL' }, txns_1h: 7, holder_count: 3 },
    });
    const s2 = solBundle(SOL_DEMO_MINT_USDC, 'USDC', 'USD Coin', null, 12, 8_000_000_000, 45_000_000, {
      decimals: 6,
    });
    const s3 = solBundle(SOL_DEMO_MINT_WSOL, 'SOL', 'Wrapped SOL', null, 40, 3_200_000_000_000, 400_000_000, {
      decimals: 9,
    });

    /** Graduated tab — one launchpad type per row for ring / badge QA. */
    if (column === 'migrated') {
      const migratedTs = now();
      const dmMayhem = solBundle(SOL_DEMO_MINT_WIF, 'MHM', 'Mayhem graduated demo', 'mayhem', 0.4, 1_890, 22, {
        migrated_at: migratedTs,
        raw_metadata: { mayhemMode: true, isMayhemMode: true, F: 100, pointerIngestSource: 'pump_mayhem' },
        snapshotPatch: {
          txns_1h: 7,
          extended_metrics: { mayhemMode: true, pro_traders: 1, F: 100 },
        },
      });
      const dmPump = solBundle(SOL_DEMO_MINT_POPCAT, 'PUMP', 'Pump graduated demo', 'pump.fun', 120, 220_000_000, 9_900_000, {
        decimals: 5,
        migrated_at: migratedTs,
        twitter_handle: 'https://x.com/elonmusk',
        raw_metadata: { F: 100, bondingCurveProgress: 100 },
        snapshotPatch: { txns_1h: 511, extended_metrics: { pro_traders: 205, F: 100 } },
      });
      const dmBonk = solBundle(SOL_DEMO_MINT_BONK, 'BONK', 'Bonk graduated demo', 'bonk', 180, 52_000_000, 3_200_000, {
        decimals: 5,
        migrated_at: migratedTs,
        twitter_handle: 'https://x.com/bonk_inu',
        raw_metadata: { F: 100 },
        snapshotPatch: { extended_metrics: { pro_traders: 88, F: 100 } },
      });

      const dmRay = solBundle(SOL_DEMO_MINT_RAY, 'GDOR', 'Global Digital Oil', 'raydium', 120, 1_100, 310, {
        migrated_at: migratedTs,
        raw_metadata: { poolType: 'raydium-clmm', F: 100 },
        snapshotPatch: { extended_metrics: { protocol: 'raydium-clmm', F: 100 }, txns_1h: 18 },
      });
      const dmBags = solBundle(SOL_DEMO_MINT_BOME, 'BAGS', 'Bags graduated demo', 'bags', 95, 18_000_000, 1_100_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          programId: 'BSfTAhiifGCG9wftxQp7DjPkBkwjFxNsoEjr3iJYhyR8',
          source: 'bags.fm',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100 }, txns_1h: 42 },
      });
      const dmPrintr = solBundle(SOL_DEMO_MINT_JUP, 'MPT', 'My Printr Token', 'printr', 60, 9_500_000, 720_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'printr',
          programId: 'Pr1NTtR67xZJaR5JG7nT4CMhGwDFqpzN5JhtXXn8nEM',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 31 },
      });
      const dmSoar = solBundle(SOL_DEMO_MINT_MSOL, 'SOAR', 'Soar graduated demo', 'soar', 45, 2_800_000, 410_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'launchonsoar',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 24 },
      });
      const dmSurge = solBundle(SOL_DEMO_MINT_ORCA, 'SRGE', 'Surge graduated demo', 'surge', 72, 1_600_000, 290_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'surge.xyz',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 19 },
      });
      const dmHeaven = solBundle(SOL_DEMO_MINT_WSOL, 'HVEN', 'Heaven graduated demo', 'heaven', 96, 3_400_000, 520_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          launchpad: 'heaven.xyz',
          source: 'heaven.xyz',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 28 },
      });
      const dmMoonshot = solBundle(SOL_DEMO_MINT_USDC, 'MOON', 'Moonshot graduated demo', 'moonshot', 84, 2_100_000, 380_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          programId: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
          source: 'moonshot',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 33 },
      });
      const dmMoonit = solBundle(SOL_DEMO_MINT_RAY, 'MNIT', 'Moonit graduated demo', 'moonit', 88, 2_450_000, 405_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          programId: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
          source: 'moon.it',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 36 },
      });
      const dmDynamicBc = solBundle(SOL_DEMO_MINT_JUP, 'DBC', 'Dynamic BC graduated demo', 'dynamic-bc', 78, 1_750_000, 295_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          poolType: 'dynamic-bonding-curve',
          source: 'meteora-dbc',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'dynamic-bonding-curve', quoteSymbol: 'SOL' }, txns_1h: 27 },
      });
      const dmDaos = solBundle(SOL_DEMO_MINT_BOME, 'DAOS', 'Daos.fun graduated demo', 'daos.fun', 90, 2_200_000, 340_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'daos.fun',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'SOL' }, txns_1h: 22 },
      });
      const dmJupStudio = solBundle(SOL_DEMO_MINT_WIF, 'JSTU', 'Jupiter Studio graduated demo', 'jupiter-studio', 92, 2_650_000, 390_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'studio.jup.ag',
          poolType: 'jupiter-studio',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'jupiter-studio', quoteSymbol: 'SOL' }, txns_1h: 29 },
      });
      const dmLaunchlab = solBundle(SOL_DEMO_MINT_POPCAT, 'LLAB', 'LaunchLab graduated demo', 'launchlab', 94, 1_920_000, 360_000, {
        decimals: 5,
        migrated_at: migratedTs,
        raw_metadata: {
          programId: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
          source: 'raydium launchlab',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'launchlab', quoteSymbol: 'SOL' }, txns_1h: 26 },
      });
      const dmOrca = solBundle(SOL_DEMO_MINT_MSOL, 'ORCA', 'Orca Wavebreak graduated demo', 'orca', 98, 2_100_000, 375_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          source: 'orca.so/wavebreak',
          poolType: 'wavebreak',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'wavebreak', quoteSymbol: 'SOL' }, txns_1h: 31 },
      });
      const dmMeteora = solBundle(SOL_DEMO_MINT_WIF, 'MET', 'Meteora AMM graduated demo', 'meteora', 100, 2_350_000, 400_000, {
        migrated_at: migratedTs,
        raw_metadata: {
          poolType: 'damm-v2',
          source: 'meteora amm v2',
          F: 100,
        },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'meteora-amm-v2', quoteSymbol: 'SOL' }, txns_1h: 34 },
      });

      return [dmPump, dmBonk, dmMayhem, dmRay, dmBags, dmPrintr, dmSoar, dmSurge, dmHeaven, dmMoonshot, dmMoonit, dmDynamicBc, dmDaos, dmJupStudio, dmLaunchlab, dmOrca, dmMeteora];
    }

    if (column === 'new') return [sPumpUsdc, sPumpSol, sPumpUsdc2, sMeteora, sOrca, sLaunchlab, sJupStudio, sJupStudio2, sMoonit, sMoonit2, sMoonit3, sDaos, sDaos2, sDaos3, sDynamicBc, sDynamicBc2, sMoonshot, sHeaven, sSurge, sSoar, sBags, sPrintr, sRay, sMayhem, sPump, sBonk, sUsd1, s2, s3];
    if (column === 'stretch') {
      return [
        withBondingProgress(sPump, 91),
        withBondingProgress(sBonk, 88),
        withBondingProgress(sBags, 92),
        withBondingProgress(sPrintr, 89),
        withBondingProgress(sSoar, 93),
        withBondingProgress(sSurge, 87),
        withBondingProgress(sHeaven, 90),
        withBondingProgress(sMoonshot, 86),
        withBondingProgress(sMoonit, 94),
        withBondingProgress(sDynamicBc, 88),
        withBondingProgress(sDaos3, 91),
        withBondingProgress(sJupStudio, 89),
        withBondingProgress(sLaunchlab, 92),
        withBondingProgress(sOrca, 88),
        withBondingProgress(sMeteora, 90),
        withBondingProgress(sRay, 87),
        withBondingProgress(sMayhem, 93),
      ];
    }
    return [s3, sPump, sBonk];
  }

  if (chain === 'bnb') {
    const fmPizza = evmBundle('0x4444444444444444444444444444444444444441', 'PIZZA', 'Pizza Boy', 'four.meme', 2, 3_820, 45, {
      raw_metadata: { F: 1.49, bondingCurveProgress: 1.49, source: 'four.meme' },
      snapshotPatch: { extended_metrics: { F: 1.49, quoteSymbol: 'BNB' }, txns_1h: 1, holder_count: 1 },
    });
    const fmAlpha = evmBundle('0x4444444444444444444444444444444444444442', '4ALPHA', '4lpha agent', 'four.meme', 3, 4_190, 251, {
      raw_metadata: { F: 2.1, bondingCurveProgress: 2.1, source: 'four.meme' },
      snapshotPatch: { extended_metrics: { quoteSymbol: 'WBNB' }, txns_1h: 11, holder_count: 3 },
    });
    const fmPotus = evmBundle('0x4444444444444444444444444444444444444443', 'POTUS', 'POTUS', 'four.meme', 4, 5_100, 180, {
      raw_metadata: { F: 6, bondingCurveProgress: 6, source: 'four.meme' },
      snapshotPatch: { extended_metrics: { quoteSymbol: 'BNB' }, txns_1h: 5, holder_count: 2 },
    });
    const flapBnb = evmBundle('0x5555555555555555555555555555555555555551', 'BNB', 'BNB', 'flap', 0.58, 3_610, 0, {
      raw_metadata: { F: 0, bondingCurveProgress: 0, source: 'flap.sh' },
      snapshotPatch: { extended_metrics: { F: 0, quoteSymbol: 'BNB' }, txns_1h: 1, holder_count: 0 },
    });
    const flapMarsh = evmBundle('0x5555555555555555555555555555555555555552', 'MELT', 'Melting Marshmallow', 'flap', 0.67, 4_200, 120, {
      raw_metadata: { F: 2.4, bondingCurveProgress: 2.4, source: 'flap' },
      snapshotPatch: { extended_metrics: { quoteSymbol: 'WBNB' }, txns_1h: 4, holder_count: 1 },
    });
    const flapBr = evmBundle('0x5555555555555555555555555555555555555553', 'BR', 'Brazil', 'flap', 0.75, 3_900, 85, {
      raw_metadata: { F: 1.8, bondingCurveProgress: 1.8, source: 'flap.sh' },
      snapshotPatch: { extended_metrics: { quoteSymbol: 'BNB' }, txns_1h: 2, holder_count: 0 },
    });
    const pcTrx = evmBundle('0x6666666666666666666666666666666666666661', 'TRX', 'Tron', 'pancakeswap', 1, 365_000_000, 15, {
      raw_metadata: { poolType: 'pancakeswap-v3', source: 'pancakeswap', F: 42, bondingCurveProgress: 42 },
      snapshotPatch: { extended_metrics: { F: 42, protocol: 'pancakeswap-v3', quoteSymbol: 'BNB' }, txns_1h: 1, holder_count: 22 },
    });
    const pcBlight = evmBundle('0x6666666666666666666666666666666666666662', 'BL', 'BLIGHTWOLF', 'pancakeswap', 2, 7_540, 1_000, {
      raw_metadata: { poolType: 'pancakeswap-v3', source: 'pancakeswap', F: 11, bondingCurveProgress: 11 },
      snapshotPatch: { extended_metrics: { F: 11, quoteSymbol: 'BNB' }, txns_1h: 14, holder_count: 3 },
    });
    const pcUsda = evmBundle('0x6666666666666666666666666666666666666663', 'USDA', 'USDA', 'pancakeswap', 2.2, 6_800, 890, {
      raw_metadata: { poolType: 'pancakeswap-v3', F: 0, bondingCurveProgress: 0 },
      snapshotPatch: { extended_metrics: { protocol: 'pancakeswap-v3', quoteSymbol: 'BNB' }, txns_1h: 2, holder_count: 0 },
    });
    const pcLista = evmBundle('0x6666666666666666666666666666666666666664', 'LISTA', 'LISTA', 'pancakeswap', 3, 8_200, 420, {
      raw_metadata: { poolType: 'pancakeswap-v3', source: 'pancakeswap', F: 90, bondingCurveProgress: 90 },
      snapshotPatch: { extended_metrics: { F: 90, quoteSymbol: 'BNB' }, txns_1h: 6, holder_count: 1 },
    });
    const uniVie = evmBundle('0x7777777777777777777777777777777777777771', 'VIE', 'vie.dev', 'uniswap', 4, 0, 0, {
      raw_metadata: { poolType: 'uniswap-v4', source: 'uniswap', F: 100, bondingCurveProgress: 100 },
      snapshotPatch: { extended_metrics: { F: 100, protocol: 'uniswap-v4', quoteSymbol: 'BNB' }, txns_1h: 0, holder_count: 0 },
    });
    const uniUsdt = evmBundle('0x7777777777777777777777777777777777777772', 'L', 'L token', 'uniswap', 9, 4_200, 1, {
      raw_metadata: {
        poolType: 'uniswap-v4',
        source: 'uniswap',
        quoteMint: '0x55d398326f99059ff775485246999027b3197955',
        F: 53,
        bondingCurveProgress: 53,
      },
      snapshotPatch: { extended_metrics: { F: 53, protocol: 'uniswap-v4', quoteSymbol: 'USDT' }, txns_1h: 1, holder_count: 0 },
    });
    const uniFreedom = evmBundle('0x7777777777777777777777777777777777777773', 'FOM', 'Freedom of Money', 'uniswap', 15, 6_770_000, 1, {
      raw_metadata: { poolType: 'uniswap-v4', source: 'uniswap', F: 100, bondingCurveProgress: 100 },
      snapshotPatch: { extended_metrics: { F: 100, protocol: 'uniswap-v4', quoteSymbol: 'BNB' }, txns_1h: 2, holder_count: 4 },
    });

    if (column === 'migrated') {
      const migratedTs = now();
      const dmFour = evmBundle('0x4444444444444444444444444444444444444444', 'FMEME', 'Four.meme graduated', 'four.meme', 100, 890_000, 45_000, {
        migrated_at: migratedTs,
        raw_metadata: { F: 100, source: 'four.meme' },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'BNB' }, txns_1h: 88 },
      });
      const dmFlap = evmBundle('0x5555555555555555555555555555555555555554', 'FLAP', 'Flap graduated demo', 'flap', 100, 720_000, 38_000, {
        migrated_at: migratedTs,
        raw_metadata: { F: 100, source: 'flap.sh' },
        snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'BNB' }, txns_1h: 64 },
      });
      const dmPc = evmBundle('0x6666666666666666666666666666666666666665', 'CAKE', 'Pancakeswap graduated', 'pancakeswap', 100, 1_620_000_000, 44_000_000, {
        migrated_at: migratedTs,
        raw_metadata: { F: 100, poolType: 'pancakeswap-v3', source: 'pancakeswap' },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'pancakeswap-v3', quoteSymbol: 'BNB' }, txns_1h: 120 },
      });
      const dmUni = evmBundle('0x7777777777777777777777777777777777777774', 'UNI', 'Uniswap V4 graduated', 'uniswap', 100, 980_000, 52_000, {
        migrated_at: migratedTs,
        raw_metadata: { F: 100, poolType: 'uniswap-v4', source: 'uniswap' },
        snapshotPatch: { extended_metrics: { F: 100, protocol: 'uniswap-v4', quoteSymbol: 'BNB' }, txns_1h: 95 },
      });
      return [dmFour, dmFlap, dmPc, dmUni];
    }
    if (column === 'new') return [uniVie, uniUsdt, uniFreedom, pcTrx, pcBlight, pcUsda, flapBnb, pcLista, fmPizza, flapMarsh, fmAlpha, flapBr, fmPotus];
    if (column === 'stretch') {
      return [
        withBondingProgress(fmPizza, 91),
        withBondingProgress(fmAlpha, 88),
        withBondingProgress(flapMarsh, 92),
        withBondingProgress(flapBr, 89),
        withBondingProgress(pcBlight, 93),
        withBondingProgress(pcLista, 87),
        withBondingProgress(uniUsdt, 90),
        withBondingProgress(uniFreedom, 86),
      ];
    }
    return [fmPotus];
  }

  if (chain === 'base') {
    const baseDemo = (
      suffix: string,
      symbol: string,
      name: string,
      launchPad: string,
      ageMin: number,
      mcUsd: number,
      volUsd: number,
      f: number,
      quote = 'ETH',
    ) =>
      evmBundle(`0x888888888888888888888888888888888888${suffix}`, symbol, name, launchPad, ageMin, mcUsd, volUsd, {
        raw_metadata: { F: f, bondingCurveProgress: f, source: launchPad },
        snapshotPatch: {
          extended_metrics: { F: f, quoteSymbol: quote, protocol: launchPad },
          txns_1h: Math.max(1, Math.floor(f / 4)),
        },
      });

    const sClanker = baseDemo('8801', 'CLNK', 'Clanker fresh', 'clanker', 0.5, 5_200, 220, 8);
    const sBankr = baseDemo('8802', 'BNKR', 'Bankr agent', 'bankr', 1.2, 4_800, 190, 14);
    const sFlaunch = baseDemo('8803', 'FLCH', 'Flaunch meme', 'flaunch', 2, 6_100, 310, 22);
    const sZoraContent = baseDemo('8804', 'ZORA', 'Zora content coin', 'zora-content', 3, 3_900, 140, 18);
    const sZoraCreator = baseDemo('8805', 'CR8R', 'Zora creator coin', 'zora-creator', 4, 4_400, 160, 26);
    const sBaseapp = baseDemo('8806', 'BAPP', 'Baseapp launch', 'baseapp', 5, 7_200, 280, 31);
    const sBasememe = baseDemo('8807', 'BMEME', 'Basememe', 'basememe', 6, 2_800, 95, 9);
    const sVirtuals = baseDemo('8808', 'VRTL', 'Virtuals Uni', 'virtuals', 7, 8_500, 420, 44, 'VIRTUAL');
    const sKlik = baseDemo('8809', 'KLIK', 'Klik launch', 'klik', 8, 5_600, 210, 16);

    if (column === 'migrated') {
      const migratedTs = now();
      const grad = (suffix: string, symbol: string, name: string, launchPad: string) =>
        evmBundle(`0x888888888888888888888888888888888888${suffix}`, symbol, name, launchPad, 100, 620_000, 28_000, {
          migrated_at: migratedTs,
          raw_metadata: { F: 100, source: launchPad },
          snapshotPatch: { extended_metrics: { F: 100, quoteSymbol: 'ETH', protocol: launchPad }, txns_1h: 72 },
        });
      return [
        grad('8811', 'CLNK', 'Clanker graduated', 'clanker'),
        grad('8812', 'BNKR', 'Bankr graduated', 'bankr'),
        grad('8813', 'FLCH', 'Flaunch graduated', 'flaunch'),
        grad('8814', 'ZORA', 'Zora content graduated', 'zora-content'),
        grad('8815', 'CR8R', 'Zora creator graduated', 'zora-creator'),
        grad('8816', 'BAPP', 'Baseapp graduated', 'baseapp'),
        grad('8817', 'BMEME', 'Basememe graduated', 'basememe'),
        grad('8818', 'VRTL', 'Virtuals graduated', 'virtuals'),
        grad('8819', 'KLIK', 'Klik graduated', 'klik'),
      ];
    }
    if (column === 'new') {
      return [sClanker, sBankr, sFlaunch, sZoraContent, sZoraCreator, sBaseapp, sBasememe, sVirtuals, sKlik];
    }
    if (column === 'stretch') {
      return [
        withBondingProgress(sClanker, 91),
        withBondingProgress(sBankr, 88),
        withBondingProgress(sFlaunch, 92),
        withBondingProgress(sZoraContent, 89),
        withBondingProgress(sZoraCreator, 93),
        withBondingProgress(sBaseapp, 87),
        withBondingProgress(sBasememe, 90),
        withBondingProgress(sVirtuals, 86),
        withBondingProgress(sKlik, 94),
      ];
    }
    return [sVirtuals, sKlik];
  }

  if (chain === 'ton') {
    const tonDemo = (
      mint: string,
      symbol: string,
      name: string,
      launchPad: string,
      ageMin: number,
      mcUsd: number,
      volUsd: number,
      f: number,
    ) => {
      const b = bundle(mint, symbol, name, launchPad, ageMin, mcUsd, volUsd);
      return {
        ...b,
        token: {
          ...b.token,
          raw_metadata: { F: f, bondingCurveProgress: f, source: launchPad },
        },
        snapshot: b.snapshot
          ? {
              ...b.snapshot,
              extended_metrics: { F: f, quoteSymbol: 'TON', protocol: launchPad },
              txns_1h: Math.max(1, Math.floor(f / 4)),
            }
          : b.snapshot,
      };
    };

    const sUranus = tonDemo(TON_DEMO_JETTON_A, 'URAN', 'Uranus demo', 'uranus', 0.8, 4_200, 180, 12);
    const sGroypad = tonDemo(TON_DEMO_JETTON_B, 'GROY', 'Groypad demo', 'groypad', 1.5, 3_800, 140, 18);
    const sBlum = tonDemo(TON_DEMO_JETTON_C, 'BLUM', 'Blum demo', 'blum', 2.2, 5_100, 210, 24);
    const sTonfun = tonDemo(TON_DEMO_JETTON_D, 'TFUN', 'Tonfun demo', 'tonfun', 3, 6_400, 260, 31);

    if (column === 'migrated') {
      const migratedTs = now();
      const grad = (mint: string, symbol: string, name: string, launchPad: string) => {
        const b = bundle(mint, symbol, name, launchPad, 100, 520_000, 24_000);
        return {
          ...b,
          token: { ...b.token, migrated_at: migratedTs, raw_metadata: { F: 100, source: launchPad } },
          snapshot: b.snapshot
            ? {
                ...b.snapshot,
                extended_metrics: { F: 100, quoteSymbol: 'TON', protocol: launchPad },
                txns_1h: 64,
              }
            : b.snapshot,
        };
      };
      return [
        grad(TON_DEMO_JETTON_A, 'URAN', 'Uranus graduated', 'uranus'),
        grad(TON_DEMO_JETTON_B, 'GROY', 'Groypad graduated', 'groypad'),
        grad(TON_DEMO_JETTON_C, 'BLUM', 'Blum graduated', 'blum'),
        grad(TON_DEMO_JETTON_D, 'TFUN', 'Tonfun graduated', 'tonfun'),
      ];
    }
    if (column === 'new') return [sUranus, sGroypad, sBlum, sTonfun];
    if (column === 'stretch') {
      return [
        withBondingProgress(sUranus, 91),
        withBondingProgress(sGroypad, 88),
        withBondingProgress(sBlum, 92),
        withBondingProgress(sTonfun, 89),
      ];
    }
    return [sBlum, sTonfun];
  }

  return [];
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
  const { decimals: _d, snapshotPatch, ...tokenExtra } = opts ?? {};
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
      migrated_to: null,
      bonding_progress: null,
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
      holder_count: Math.min(7_200, 420 + Math.floor(mcUsd / 1_500_000)),
      top10_holder_pct: 18.5,
      dev_holding_pct: 4.2,
      extended_metrics: null,
      snapshot_at: now(),
      ...(snapshotPatch ?? {}),
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
      solBundle(SOL_DEMO_MINT_BONK, 'BONK', 'Bonk', 'bonk', 8, 1_680_000_000, 88_000_000, {
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