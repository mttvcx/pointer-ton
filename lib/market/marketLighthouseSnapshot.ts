import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';

export type LighthouseTf = '5m' | '1h' | '6h' | '24h';

export type LighthouseLaunchpadRow = {
  key: string;
  iconSrc: string;
  volumeLabel: string;
  pct: number;
};

export type LighthouseProtocolRow = {
  key: string;
  iconSrc: string;
  volumeLabel: string;
  pct: number;
};

export type MarketLighthouseSnapshot = {
  trades: { label: string; pct: number };
  traders: { label: string; pct: number };
  volume: {
    headline: string;
    pct: number;
    buyPct: number;
    buyDetail: string;
    sellDetail: string;
  };
  tokens: {
    created: { label: string; pct: number };
    migrations: { label: string; pct: number };
  };
  launchpads: [LighthouseLaunchpadRow, LighthouseLaunchpadRow];
  protocols: [LighthouseProtocolRow, LighthouseProtocolRow];
};

/** Deterministic unit interval from chain + timeframe + salt (repeatable UI numbers). */
function u(chain: AppChainId, tf: LighthouseTf, salt: string): number {
  const s = `${chain}:${tf}:${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10001) / 10001;
}

function tfScale(tf: LighthouseTf): number {
  if (tf === '5m') return 0.07;
  if (tf === '1h') return 0.2;
  if (tf === '6h') return 0.52;
  return 1;
}

function fmtCompactCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const x = Math.abs(n);
  if (x >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (x >= 100_000) return `${(n / 1000).toFixed(1)}K`;
  if (x >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function fmtUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const x = Math.abs(n);
  if (x >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (x >= 100_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function pctAround(chain: AppChainId, tf: LighthouseTf, salt: string, span = 28): number {
  const base = u(chain, tf, salt) * span - span / 2;
  return Math.round((base + Number.EPSILON) * 100) / 100;
}

export function getMarketLighthouseSnapshot(chain: AppChainId, tf: LighthouseTf): MarketLighthouseSnapshot {
  const scale = tfScale(tf);

  const tradesN =
    (chain === 'sol'
      ? 2_080_000
      : chain === 'bnb'
        ? 890_000
        : chain === 'base'
          ? 412_000
          : 226_000) *
    (0.72 + u(chain, tf, 'tr') * 0.55) *
    scale;

  const tradersN =
    (chain === 'sol'
      ? 90_400
      : chain === 'bnb'
        ? 48_200
        : chain === 'base'
          ? 31_500
          : 18_900) *
    (0.78 + u(chain, tf, 'td') * 0.44) *
    scale;

  const volUsd =
    (chain === 'sol'
      ? 596e6
      : chain === 'bnb'
        ? 214e6
        : chain === 'base'
          ? 178e6
          : 92e6) *
    (0.65 + u(chain, tf, 'vl') * 0.7) *
    scale;

  const buyRatio = 0.47 + u(chain, tf, 'buy') * 0.14;
  const buyUsd = volUsd * buyRatio;
  const sellUsd = volUsd * (1 - buyRatio);

  const createdN =
    (chain === 'sol'
      ? 23_600
      : chain === 'bnb'
        ? 14_200
        : chain === 'base'
          ? 9_800
          : 6_400) *
    (0.8 + u(chain, tf, 'cr') * 0.35) *
    Math.max(0.35, scale);

  const migN =
    (chain === 'sol'
      ? 50
      : chain === 'bnb'
        ? 128
        : chain === 'base'
          ? 86
          : 34) + Math.round(u(chain, tf, 'mg') * 40);

  const launchpads: [LighthouseLaunchpadRow, LighthouseLaunchpadRow] =
    chain === 'sol'
      ? [
          {
            key: 'pump',
            iconSrc: '/icons/pumpfun.webp',
            volumeLabel: fmtUsdCompact(54.7e6 * (0.85 + u(chain, tf, 'lp1') * 0.35)),
            pct: pctAround(chain, tf, 'lpp1', 40),
          },
          {
            key: 'sol-pad',
            iconSrc: CHAIN_ICON_PNG.sol,
            volumeLabel: fmtUsdCompact(18.2e6 * (0.75 + u(chain, tf, 'lp2') * 0.45)),
            pct: pctAround(chain, tf, 'lpp2', 36),
          },
        ]
      : chain === 'bnb'
        ? [
            {
              key: 'fourmeme',
              iconSrc: CHAIN_ICON_PNG.bnb,
              volumeLabel: fmtUsdCompact(41e6 * (0.8 + u(chain, tf, 'lp1') * 0.4)),
              pct: pctAround(chain, tf, 'lpp1', 42),
            },
            {
              key: 'pcs-launch',
              iconSrc: CHAIN_ICON_PNG.bnb,
              volumeLabel: fmtUsdCompact(15.3e3 + u(chain, tf, 'lp2') * 80_000),
              pct: pctAround(chain, tf, 'lpp2', 55),
            },
          ]
        : chain === 'base'
          ? [
              {
                key: 'virtuals',
                iconSrc: CHAIN_ICON_PNG.base,
                volumeLabel: fmtUsdCompact(29e6 * (0.72 + u(chain, tf, 'lp1') * 0.5)),
                pct: pctAround(chain, tf, 'lpp1', 44),
              },
              {
                key: 'base-deploy',
                iconSrc: CHAIN_ICON_PNG.base,
                volumeLabel: fmtUsdCompact(7.8e6 * (0.68 + u(chain, tf, 'lp2') * 0.55)),
                pct: pctAround(chain, tf, 'lpp2', 48),
              },
            ]
          : [
              {
                key: 'dedust',
                iconSrc: CHAIN_ICON_PNG.ton,
                volumeLabel: fmtUsdCompact(12e6 * (0.75 + u(chain, tf, 'lp1') * 0.45)),
                pct: pctAround(chain, tf, 'lpp1', 38),
              },
              {
                key: 'ston',
                iconSrc: CHAIN_ICON_PNG.ton,
                volumeLabel: fmtUsdCompact(6.4e6 * (0.7 + u(chain, tf, 'lp2') * 0.5)),
                pct: pctAround(chain, tf, 'lpp2', 34),
              },
            ];

  const protocols: [LighthouseProtocolRow, LighthouseProtocolRow] =
    chain === 'sol'
      ? [
          {
            key: 'jup',
            iconSrc: CHAIN_ICON_PNG.sol,
            volumeLabel: fmtUsdCompact(517e6 * (0.78 + u(chain, tf, 'pr1') * 0.5)),
            pct: pctAround(chain, tf, 'prp1', 35),
          },
          {
            key: 'ray',
            iconSrc: CHAIN_ICON_PNG.sol,
            volumeLabel: fmtUsdCompact(22.1e6 * (0.72 + u(chain, tf, 'pr2') * 0.55)),
            pct: pctAround(chain, tf, 'prp2', 48),
          },
        ]
      : chain === 'bnb'
        ? [
            {
              key: 'pcs',
              iconSrc: CHAIN_ICON_PNG.bnb,
              volumeLabel: fmtUsdCompact(517e6 * (0.74 + u(chain, tf, 'pr1') * 0.52)),
              pct: pctAround(chain, tf, 'prp1', 32),
            },
            {
              key: 'biswap',
              iconSrc: CHAIN_ICON_PNG.bnb,
              volumeLabel: fmtUsdCompact(18e6 * (0.68 + u(chain, tf, 'pr2') * 0.6)),
              pct: pctAround(chain, tf, 'prp2', 41),
            },
          ]
        : chain === 'base'
          ? [
              {
                key: 'uni',
                iconSrc: CHAIN_ICON_PNG.base,
                volumeLabel: fmtUsdCompact(221e6 * (0.76 + u(chain, tf, 'pr1') * 0.48)),
                pct: pctAround(chain, tf, 'prp1', 46),
              },
              {
                key: 'aero',
                iconSrc: CHAIN_ICON_PNG.base,
                volumeLabel: fmtUsdCompact(94e6 * (0.7 + u(chain, tf, 'pr2') * 0.52)),
                pct: pctAround(chain, tf, 'prp2', 39),
              },
            ]
          : [
              {
                key: 'stonfi',
                iconSrc: CHAIN_ICON_PNG.ton,
                volumeLabel: fmtUsdCompact(88e6 * (0.73 + u(chain, tf, 'pr1') * 0.47)),
                pct: pctAround(chain, tf, 'prp1', 36),
              },
              {
                key: 'dedust-p',
                iconSrc: CHAIN_ICON_PNG.ton,
                volumeLabel: fmtUsdCompact(31e6 * (0.69 + u(chain, tf, 'pr2') * 0.53)),
                pct: pctAround(chain, tf, 'prp2', 33),
              },
            ];

  const volPct = pctAround(chain, tf, 'vol', 26);

  return {
    trades: { label: fmtCompactCount(tradesN), pct: pctAround(chain, tf, 'tcp', 42) },
    traders: { label: fmtCompactCount(tradersN), pct: pctAround(chain, tf, 'trp', 38) },
    volume: {
      headline: fmtUsdCompact(volUsd),
      pct: volPct,
      buyPct: Math.round(buyRatio * 1000) / 10,
      buyDetail: `${fmtCompactCount(buyUsd / 4200)} / ${fmtUsdCompact(buyUsd)}`,
      sellDetail: `${fmtCompactCount(sellUsd / 3900)} / ${fmtUsdCompact(sellUsd)}`,
    },
    tokens: {
      created: {
        label: fmtCompactCount(createdN),
        pct: -Math.abs(pctAround(chain, tf, 'tokc', 22)),
      },
      migrations: {
        label: String(migN),
        pct: -Math.abs(pctAround(chain, tf, 'tokm', 12)),
      },
    },
    launchpads,
    protocols,
  };
}
