import type { AppChainId } from '@/lib/chains/appChain';
import { tokenMatchesAppChain } from '@/lib/chains/evmTokenChain';
import { protocolBrandIdFromToken } from '@/lib/protocol/tokenProtocolDisplay';
import {
  type LighthouseTf,
  type LighthouseVenueIcon,
  type LighthouseVenueRow,
  type MarketLighthouseSnapshot,
  fmtCompactCount,
  fmtUsdCompact,
  topVenuesByVolume,
} from '@/lib/market/marketLighthouseSnapshot';
import { launchPadToProtocolId, protocolBrand, protocolLogoSrc, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';
import type { PulseTokenBundle } from '@/types/tokens';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';

const TF_MS: Record<LighthouseTf, number> = {
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

type TxnSplit = { total: number; buys: number; sells: number };

type ExtendedMetrics = Record<string, unknown>;

function asExtended(raw: unknown): ExtendedMetrics | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as ExtendedMetrics;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pctDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return clampDisplayPct(((current - previous) / previous) * 100);
}

/** Avoid absurd UI percentages when Dex h24 baselines are tiny vs h1 spikes. */
function clampDisplayPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-99.99, Math.min(999.99, Math.round(n * 100) / 100));
}

function volFromSnapshot(snap: TokenMarketSnapshotRow, tf: LighthouseTf): number {
  const em = asExtended(snap.extended_metrics);
  switch (tf) {
    case '5m':
      return num(snap.volume_5m_usd);
    case '1h':
      return num(snap.volume_1h_usd);
    case '6h': {
      const h6 = num(em?.volumeH6);
      if (h6 > 0) return h6;
      const h24 = num(snap.volume_24h_usd);
      if (h24 > 0) return h24 * (6 / 24);
      return num(snap.volume_1h_usd) * 6;
    }
    case '24h':
      return num(em?.volumeH24) || num(snap.volume_24h_usd);
    default:
      return 0;
  }
}

function txnsFromSnapshot(snap: TokenMarketSnapshotRow, tf: LighthouseTf): TxnSplit {
  const em = asExtended(snap.extended_metrics);
  const windowKey =
    tf === '5m' ? 'M5' : tf === '1h' ? 'H1' : tf === '6h' ? 'H6' : 'H24';
  let buys = num(em?.[`txns${windowKey}Buys`]);
  let sells = num(em?.[`txns${windowKey}Sells`]);

  if (buys + sells <= 0) {
    if (tf === '5m') {
      const total = num(snap.txns_5m);
      return { total, buys: Math.round(total * 0.52), sells: total - Math.round(total * 0.52) };
    }
    if (tf === '1h') {
      const total = num(snap.txns_1h);
      return { total, buys: Math.round(total * 0.52), sells: total - Math.round(total * 0.52) };
    }
    const h1 = num(snap.txns_1h);
    const mult = tf === '6h' ? 6 : 24;
    const total = h1 * mult;
    return { total, buys: Math.round(total * 0.52), sells: total - Math.round(total * 0.52) };
  }

  return { total: buys + sells, buys, sells };
}

/** Momentum: recent window vs implied longer baseline (DexScreener rolling windows). */
function volumeMomentumPct(snap: TokenMarketSnapshotRow, tf: LighthouseTf): number | null {
  const h1 = num(snap.volume_1h_usd);
  const h24 = num(snap.volume_24h_usd) || num(asExtended(snap.extended_metrics)?.volumeH24);
  if (h1 <= 0 || h24 <= 0) return null;
  const implied24 = h1 * 24;
  return pctDelta(implied24, h24);
}

function resolveLaunchpadId(bundle: PulseTokenBundle, chain: AppChainId): ProtocolBrandId | null {
  const fromDb = protocolBrandIdFromToken(bundle.token);
  if (fromDb) return fromDb;
  const fromPad = launchPadToProtocolId(bundle.token.launch_pad, chain);
  if (fromPad && protocolBrand(fromPad as ProtocolBrandId)) return fromPad as ProtocolBrandId;
  if (chain === 'sol' && bundle.token.mint.toLowerCase().endsWith('pump')) return 'pump.fun';
  return null;
}

function launchpadIcon(id: ProtocolBrandId): LighthouseVenueIcon {
  switch (id) {
    case 'pump.fun':
    case 'mayhem':
      return 'pump-fun';
    case 'bonk':
    case 'bonkers':
      return 'bonk';
    case 'moonshot':
    case 'moonit':
      return 'moonshot';
    case 'dynamic-bc':
      return 'virtual-curve';
    case 'raydium':
    case 'launchlab':
      return 'raydium-clmm';
    case 'meteora':
      return 'meteora-stripe';
    default:
      return 'chain-logo';
  }
}

function dexToProtocolRow(dexIdRaw: string): {
  key: string;
  name: string;
  icon: LighthouseVenueIcon;
  protocolId?: ProtocolBrandId;
} {
  const dexId = dexIdRaw.trim().toLowerCase();
  if (dexId.includes('raydium')) {
    return { key: 'raydium-clmm', name: 'Raydium CLMM', icon: 'raydium-clmm', protocolId: 'raydium' };
  }
  if (dexId.includes('dlmm')) {
    return { key: 'meteora-dlmm', name: 'Meteora DLMM', icon: 'meteora-stripe', protocolId: 'meteora' };
  }
  if (dexId.includes('meteora') || dexId.includes('damm')) {
    return { key: 'meteora-amm-v2', name: 'Meteora AMM V2', icon: 'meteora-stripe', protocolId: 'meteora' };
  }
  if (dexId === 'pumpswap' || dexId.includes('pump')) {
    return { key: 'pumpswap', name: 'PumpSwap', icon: 'pump-fun', protocolId: 'pump.fun' };
  }
  if (dexId.includes('orca')) {
    return { key: 'orca', name: 'Orca', icon: 'chain-logo', protocolId: 'orca' };
  }
  if (dexId.includes('uniswap')) {
    return { key: dexId, name: dexId.includes('v4') ? 'Uniswap V4' : dexId.includes('v3') ? 'Uniswap V3' : 'Uniswap V2', icon: 'chain-logo', protocolId: 'uniswap' };
  }
  if (dexId.includes('pancake')) {
    return { key: 'pancakeswap', name: 'PancakeSwap', icon: 'chain-logo', protocolId: 'pancakeswap' };
  }
  return {
    key: dexId || 'unknown',
    name: dexIdRaw.trim() || 'Unknown',
    icon: 'chain-logo',
  };
}

function countInWindow(isoTimes: string[], windowMs: number, nowMs: number): number {
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const iso of isoTimes) {
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t >= cutoff) n += 1;
  }
  return n;
}

/** Pure aggregation — unit-tested without DB. */
export function aggregateMarketLighthouseFromBundles(
  bundles: PulseTokenBundle[],
  chain: AppChainId,
  tf: LighthouseTf,
  nowMs = Date.now(),
): MarketLighthouseSnapshot {
  const windowMs = TF_MS[tf];
  const prevStart = nowMs - windowMs * 2;
  const prevEnd = nowMs - windowMs;

  let totalTrades = 0;
  let totalBuyTrades = 0;
  let totalVol = 0;
  let totalBuyVol = 0;
  let momentumWeighted = 0;
  let momentumWeight = 0;

  const launchpadVol = new Map<string, { vol: number; momentum: number; momentumN: number; meta: ReturnType<typeof dexToProtocolRow> | null; protocolId: ProtocolBrandId | null }>();
  const protocolVol = new Map<string, { vol: number; momentum: number; momentumN: number; meta: ReturnType<typeof dexToProtocolRow> }>();

  const createdTimes: string[] = [];
  const migratedTimes: string[] = [];

  for (const bundle of bundles) {
    if (!tokenMatchesAppChain(bundle.token, chain)) continue;

    createdTimes.push(bundle.token.created_at);
    if (bundle.token.migrated_at) migratedTimes.push(bundle.token.migrated_at);

    const snap = bundle.snapshot;
    if (!snap) continue;

    const vol = volFromSnapshot(snap, tf);
    if (vol <= 0) continue;

    const txns = txnsFromSnapshot(snap, tf);
    totalTrades += txns.total;
    totalBuyTrades += txns.buys;
    totalVol += vol;
    if (txns.total > 0) {
      totalBuyVol += vol * (txns.buys / txns.total);
    }

    const mom = volumeMomentumPct(snap, tf);
    if (mom != null) {
      momentumWeighted += mom * vol;
      momentumWeight += vol;
    }

    const launchpadId = resolveLaunchpadId(bundle, chain);
    if (launchpadId) {
      const key = launchpadId;
      const cur = launchpadVol.get(key) ?? {
        vol: 0,
        momentum: 0,
        momentumN: 0,
        meta: null,
        protocolId: launchpadId,
      };
      cur.vol += vol;
      if (mom != null) {
        cur.momentum += mom * vol;
        cur.momentumN += vol;
      }
      launchpadVol.set(key, cur);
    }

    const dexId = typeof asExtended(snap.extended_metrics)?.dexId === 'string'
      ? String(asExtended(snap.extended_metrics)!.dexId)
      : null;
    if (dexId) {
      const meta = dexToProtocolRow(dexId);
      const cur = protocolVol.get(meta.key) ?? { vol: 0, momentum: 0, momentumN: 0, meta };
      cur.vol += vol;
      if (mom != null) {
        cur.momentum += mom * vol;
        cur.momentumN += vol;
      }
      protocolVol.set(meta.key, cur);
    }
  }

  const createdNow = countInWindow(createdTimes, windowMs, nowMs);
  const createdPrev = createdTimes.filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= prevStart && t < prevEnd;
  }).length;

  const migratedNow = countInWindow(migratedTimes, windowMs, nowMs);
  const migratedPrev = migratedTimes.filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= prevStart && t < prevEnd;
  }).length;

  const sellVol = Math.max(0, totalVol - totalBuyVol);
  const buyRatio = totalVol > 0 ? totalBuyVol / totalVol : 0.5;
  const tradersEst = totalTrades > 0 ? Math.max(1, Math.round(totalTrades / 6.2)) : 0;

  const launchpadRows: LighthouseVenueRow[] = [...launchpadVol.entries()].map(([key, row]) => {
    const brand = protocolBrand(row.protocolId ?? (key as ProtocolBrandId));
    const pct =
      row.momentumN > 0 ? clampDisplayPct(row.momentum / row.momentumN) : 0;
    return {
      key,
      name: brand?.label ?? key,
      tooltip: `${brand?.label ?? key} Volume`,
      icon: launchpadIcon(row.protocolId ?? 'pump.fun'),
      protocolId: row.protocolId ?? undefined,
      iconSrc: row.protocolId ? protocolLogoSrc(row.protocolId) : undefined,
      volumeLabel: fmtUsdCompact(row.vol),
      volumeUsd: row.vol,
      pct,
    };
  });

  const protocolRows: LighthouseVenueRow[] = [...protocolVol.entries()].map(([key, row]) => {
    const pct =
      row.momentumN > 0 ? clampDisplayPct(row.momentum / row.momentumN) : 0;
    return {
      key,
      name: row.meta.name,
      tooltip: `${row.meta.name} Volume`,
      icon: row.meta.icon,
      protocolId: row.meta.protocolId,
      iconSrc: row.meta.protocolId ? protocolLogoSrc(row.meta.protocolId) : undefined,
      volumeLabel: fmtUsdCompact(row.vol),
      volumeUsd: row.vol,
      pct,
    };
  });

  const volPct = momentumWeight > 0 ? clampDisplayPct(momentumWeighted / momentumWeight) : 0;

  return {
    trades: {
      label: fmtCompactCount(totalTrades),
      pct: volPct,
    },
    traders: {
      label: fmtCompactCount(tradersEst),
      pct: volPct * 0.85,
    },
    volume: {
      headline: fmtUsdCompact(totalVol),
      pct: volPct,
      buyPct: Math.round(buyRatio * 1000) / 10,
      buyDetail: `${fmtCompactCount(totalBuyTrades)} / ${fmtUsdCompact(totalBuyVol)}`,
      sellDetail: `${fmtCompactCount(Math.max(0, totalTrades - totalBuyTrades))} / ${fmtUsdCompact(sellVol)}`,
    },
    tokens: {
      created: {
        label: fmtCompactCount(createdNow),
        pct: pctDelta(createdNow, createdPrev),
      },
      migrations: {
        label: String(migratedNow),
        pct: pctDelta(migratedNow, migratedPrev),
      },
    },
    launchpads: topVenuesByVolume(launchpadRows),
    protocols: topVenuesByVolume(protocolRows),
  };
}
