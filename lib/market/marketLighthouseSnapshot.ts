import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';

export type LighthouseTf = '5m' | '1h' | '6h' | '24h';

export type LighthouseVenueIcon =
  | 'pump-fun'
  | 'bonk'
  | 'virtual-curve'
  | 'meteora-stripe'
  | 'raydium-clmm'
  | 'moonshot'
  | 'chain-logo';

export type LighthouseVenueRow = {
  key: string;
  name: string;
  tooltip: string;
  icon: LighthouseVenueIcon;
  /** When set, used for chain-logo icon kind. */
  iconSrc?: string;
  volumeLabel: string;
  /** Used to hide optional rows (e.g. Moonshot) when zero / missing. */
  volumeUsd?: number;
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
  launchpads: LighthouseVenueRow[];
  protocols: LighthouseVenueRow[];
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

function genericVenueRows(
  chain: AppChainId,
  tf: LighthouseTf,
  kind: 'launchpad' | 'protocol',
): LighthouseVenueRow[] {
  const icon = 'chain-logo' as const;
  const iconSrc = CHAIN_ICON_PNG[chain];
  const salt = kind === 'launchpad' ? 'lp' : 'pr';
  const names =
    kind === 'launchpad'
      ? ['Launchpad A', 'Launchpad B', 'Launchpad C']
      : ['Protocol A', 'Protocol B', 'Protocol C'];

  return names.map((name, i) => {
    const vol = (kind === 'launchpad' ? 12e6 : 88e6) * (0.7 + u(chain, tf, `${salt}${i}`) * 0.5) * tfScale(tf);
    return {
      key: `${kind}-${i}`,
      name,
      tooltip: `${name} Volume`,
      icon,
      iconSrc,
      volumeLabel: fmtUsdCompact(vol),
      volumeUsd: vol,
      pct: pctAround(chain, tf, `${salt}p${i}`, 40),
    };
  });
}

function solLaunchpads(chain: AppChainId, tf: LighthouseTf): LighthouseVenueRow[] {
  const pumpVol = 862_000 * (0.85 + u(chain, tf, 'lp1') * 0.35);
  const bonkVol = 4_000 * (0.75 + u(chain, tf, 'lp2') * 0.45);
  const virtualVol = 2_510 * (0.7 + u(chain, tf, 'lp3') * 0.55);
  const moonVol = 18_400 * (0.65 + u(chain, tf, 'moon') * 0.4);

  const rows: LighthouseVenueRow[] = [
    {
      key: 'pump',
      name: 'pump.fun',
      tooltip: 'pump.fun Volume',
      icon: 'pump-fun',
      volumeLabel: fmtUsdCompact(pumpVol),
      volumeUsd: pumpVol,
      pct: pctAround(chain, tf, 'lpp1', 40),
    },
    {
      key: 'bonk',
      name: 'Bonk',
      tooltip: 'Bonk Volume',
      icon: 'bonk',
      volumeLabel: fmtUsdCompact(bonkVol),
      volumeUsd: bonkVol,
      pct: pctAround(chain, tf, 'lpp2', 36),
    },
    {
      key: 'virtual-curve',
      name: 'Virtual Curve',
      tooltip: 'Virtual Curve Volume',
      icon: 'virtual-curve',
      volumeLabel: fmtUsdCompact(virtualVol),
      volumeUsd: virtualVol,
      pct: pctAround(chain, tf, 'lpp3', 48),
    },
  ];

  if (moonVol > 0) {
    rows.push({
      key: 'moonshot',
      name: 'Moonshot',
      tooltip: 'Moonshot App Volume',
      icon: 'moonshot',
      volumeLabel: fmtUsdCompact(moonVol),
      volumeUsd: moonVol,
      pct: pctAround(chain, tf, 'moonp', 44),
    });
  }

  return rows;
}

function solProtocols(chain: AppChainId, tf: LighthouseTf): LighthouseVenueRow[] {
  const meteoraAmm = 9.68e6 * (0.78 + u(chain, tf, 'pr1') * 0.5);
  const rayClmm = 894_000 * (0.72 + u(chain, tf, 'pr2') * 0.55);
  const meteoraDlmm = 497_000 * (0.7 + u(chain, tf, 'pr3') * 0.52);

  return [
    {
      key: 'meteora-amm-v2',
      name: 'Meteora AMM V2',
      tooltip: 'Meteora AMM V2 Volume',
      icon: 'meteora-stripe',
      volumeLabel: fmtUsdCompact(meteoraAmm),
      volumeUsd: meteoraAmm,
      pct: pctAround(chain, tf, 'prp1', 35),
    },
    {
      key: 'raydium-clmm',
      name: 'Raydium CLMM',
      tooltip: 'Raydium CLMM Volume',
      icon: 'raydium-clmm',
      volumeLabel: fmtUsdCompact(rayClmm),
      volumeUsd: rayClmm,
      pct: pctAround(chain, tf, 'prp2', 48),
    },
    {
      key: 'meteora-dlmm',
      name: 'Meteora DLMM',
      tooltip: 'Meteora DLMM Volume',
      icon: 'meteora-stripe',
      volumeLabel: fmtUsdCompact(meteoraDlmm),
      volumeUsd: meteoraDlmm,
      pct: pctAround(chain, tf, 'prp3', 33),
    },
  ];
}

/** Keep only the largest venues for the fixed no-scroll panel (Axiom shows top 3). */
function topVenuesByVolume(rows: LighthouseVenueRow[], n = 3): LighthouseVenueRow[] {
  return [...rows]
    .filter((r) => r.volumeUsd == null || r.volumeUsd > 0)
    .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
    .slice(0, n);
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

  const launchpads = topVenuesByVolume(
    chain === 'sol' ? solLaunchpads(chain, tf) : genericVenueRows(chain, tf, 'launchpad'),
  );
  const protocols = topVenuesByVolume(
    chain === 'sol' ? solProtocols(chain, tf) : genericVenueRows(chain, tf, 'protocol'),
  );

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

/** True when snapshot has displayable market stats (hides empty-state copy). */
export function marketLighthouseHasData(snap: MarketLighthouseSnapshot): boolean {
  return snap.trades.label !== '—' && snap.traders.label !== '—' && snap.volume.headline !== '—';
}
