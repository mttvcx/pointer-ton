import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';

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
  /** Prefer {@link ProtocolBrandIcon} when set. */
  protocolId?: ProtocolBrandId;
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

export function fmtCompactCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const x = Math.abs(n);
  if (x >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (x >= 100_000) return `${(n / 1000).toFixed(1)}K`;
  if (x >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function fmtUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const x = Math.abs(n);
  if (x >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (x >= 100_000) return `$${(n / 1000).toFixed(1)}K`;
  if (x >= 10_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** Keep only the largest venues for the fixed no-scroll panel (Axiom shows top 3). */
export function topVenuesByVolume(rows: LighthouseVenueRow[], n = 3): LighthouseVenueRow[] {
  return [...rows]
    .filter((r) => r.volumeUsd == null || r.volumeUsd > 0)
    .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
    .slice(0, n);
}

/** Empty snapshot when API has not loaded yet. */
export function emptyMarketLighthouseSnapshot(): MarketLighthouseSnapshot {
  return {
    trades: { label: '—', pct: 0 },
    traders: { label: '—', pct: 0 },
    volume: {
      headline: '—',
      pct: 0,
      buyPct: 50,
      buyDetail: '— / —',
      sellDetail: '— / —',
    },
    tokens: {
      created: { label: '—', pct: 0 },
      migrations: { label: '—', pct: 0 },
    },
    launchpads: [],
    protocols: [],
  };
}

/** True when snapshot has displayable market stats (hides empty-state copy). */
export function marketLighthouseHasData(snap: MarketLighthouseSnapshot): boolean {
  return snap.trades.label !== '—' && snap.traders.label !== '—' && snap.volume.headline !== '—';
}

/** @deprecated Placeholder — use {@link fetchMarketLighthouseSnapshot} via `/api/market/lighthouse`. */
export function getMarketLighthouseSnapshot(chain: AppChainId, _tf: LighthouseTf): MarketLighthouseSnapshot {
  void chain;
  return emptyMarketLighthouseSnapshot();
}

export { CHAIN_ICON_PNG };
