import { differenceInHours } from 'date-fns';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type {
  BubbleAccent,
  ConfidenceLevel,
  ExploreFilterState,
  ExploreSignalBadge,
  ExploreSortMode,
  ExploreTimeWindow,
  MindshareWeightConfig,
  SocialCatalystType,
  SocialSourceItem,
  TokenExploreItem,
  TrendDirection,
} from '@/types/explore';
import type { PulseTokenBundle } from '@/types/tokens';

export const DEFAULT_MINDSHARE_WEIGHTS: MindshareWeightConfig = {
  social: 0.35,
  wallet: 0.25,
  market: 0.2,
  event: 0.1,
  momentum: 0.1,
  riskPenaltyMax: 0.35,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function cohortPercentile(samples: number[], value: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) {
    const only = samples[0];
    if (only === undefined || !Number.isFinite(only)) return 0;
    if (!Number.isFinite(value)) return 0;
    return value < only ? 0 : value > only ? 1 : 0.5;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const strictlyLess = sorted.filter((v) => v < value).length;
  const equalCount = sorted.filter((v) => v === value).length;
  const mid = strictlyLess + (equalCount > 0 ? (equalCount - 1) / 2 : 0);
  return clamp(mid / (sorted.length - 1), 0, 1);
}

function windowHours(window: ExploreTimeWindow): number {
  switch (window) {
    case '5m':
      return 5 / 60;
    case '1h':
      return 1;
    case '6h':
      return 6;
    case '24h':
      return 24;
    default:
      return 24;
  }
}

export function pickVolumeUsd(s: TokenMarketSnapshotRow | null, window: ExploreTimeWindow): number | null {
  if (!s) return null;
  const v5 = s.volume_5m_usd != null ? Number(s.volume_5m_usd) : null;
  const v1 = s.volume_1h_usd != null ? Number(s.volume_1h_usd) : null;
  const v24 = s.volume_24h_usd != null ? Number(s.volume_24h_usd) : null;
  switch (window) {
    case '5m':
      return v5 != null && Number.isFinite(v5) ? v5 : null;
    case '1h':
      return v1 != null && Number.isFinite(v1) ? v1 : null;
    case '6h': {
      if (v1 != null && Number.isFinite(v1)) return v1 * 6;
      if (v24 != null && Number.isFinite(v24)) return v24 / 4;
      return null;
    }
    case '24h':
      return v24 != null && Number.isFinite(v24) ? v24 : null;
    default:
      return null;
  }
}

function pickTxnCount(s: TokenMarketSnapshotRow | null, window: ExploreTimeWindow): number | null {
  if (!s) return null;
  const a = s.txns_5m != null ? Number(s.txns_5m) : null;
  const b = s.txns_1h != null ? Number(s.txns_1h) : null;
  switch (window) {
    case '5m':
      return a != null && Number.isFinite(a) ? a : null;
    case '1h':
      return b != null && Number.isFinite(b) ? b : null;
    case '6h':
      return b != null && Number.isFinite(b) ? b * 6 : null;
    case '24h':
      return b != null && Number.isFinite(b) ? b * 24 : null;
    default:
      return null;
  }
}

function socialPresenceScore(bundle: PulseTokenBundle): number {
  const { token } = bundle;
  let s = 0;
  const tw = token.twitter_handle?.trim();
  if (tw) s += 16;
  const tg = token.telegram_url?.trim();
  if (tg) s += 10;
  const web = token.website_url?.trim();
  if (web) s += 6;
  return clamp(s, 0, 36);
}

function riskScoreFromSnapshot(snapshot: TokenMarketSnapshotRow | null): number {
  if (!snapshot) return 72;
  let r = 18;
  const mcap = snapshot.market_cap_usd != null ? Number(snapshot.market_cap_usd) : 0;
  const liq = snapshot.liquidity_usd != null ? Number(snapshot.liquidity_usd) : 0;
  if (mcap > 5_000) {
    const ratio = liq / Math.max(mcap, 1);
    if (ratio < 0.015) r += 38;
    else if (ratio < 0.04) r += 24;
    else if (ratio < 0.08) r += 12;
    else if (ratio < 0.12) r += 6;
  } else if (mcap > 0 && liq > 0) {
    const ratio = liq / mcap;
    if (ratio < 0.05) r += 18;
  }
  const top10 = snapshot.top10_holder_pct != null ? Number(snapshot.top10_holder_pct) : null;
  if (top10 != null && Number.isFinite(top10)) {
    if (top10 > 70) r += 22;
    else if (top10 > 55) r += 14;
    else if (top10 > 42) r += 8;
  }
  const devPct = snapshot.dev_holding_pct != null ? Number(snapshot.dev_holding_pct) : null;
  if (devPct != null && Number.isFinite(devPct) && devPct > 18) r += 16;
  else if (devPct != null && devPct > 10) r += 10;
  return clamp(r, 0, 100);
}

function confidenceFrom(snapshot: TokenMarketSnapshotRow | null): ConfidenceLevel {
  if (!snapshot?.snapshot_at) return 'low';
  const staleH = differenceInHours(new Date(), new Date(snapshot.snapshot_at));
  if (staleH > 12) return 'low';
  if (
    staleH > 2 ||
    snapshot.volume_24h_usd == null ||
    snapshot.liquidity_usd == null ||
    snapshot.market_cap_usd == null
  )
    return 'medium';
  return 'high';
}

function momentumScore(
  cohortVolRatios: number[],
  selfRatio: number,
): number {
  if (cohortVolRatios.length === 0) return 0;
  const p = cohortPercentile(cohortVolRatios, selfRatio);
  return clamp(Math.round(p * 100), 0, 100);
}

function pickAccent(
  social: number,
  risk: number,
  trend: TrendDirection,
  event: number,
): BubbleAccent {
  if (event >= 40) return 'event';
  if (risk >= 68 && risk >= social + 10) return 'risk';
  if (social >= 22) return 'social';
  if (trend === 'rising' && risk < 58) return 'bull';
  return 'neutral';
}

function trendFromMomentum(m: number): TrendDirection {
  if (m >= 58) return 'rising';
  if (m <= 42) return 'falling';
  return 'flat';
}

function buildSocialSources(bundle: PulseTokenBundle): SocialSourceItem[] {
  const { token } = bundle;
  const mint = token.mint;
  const ticker = token.symbol?.trim() || token.name?.trim() || mint.slice(0, 6);
  const out: SocialSourceItem[] = [];
  const tw = token.twitter_handle?.trim();
  if (tw) {
    const handle = tw.replace(/^@+/, '');
    const url = `https://x.com/${encodeURIComponent(handle)}`;
    out.push({
      id: `${mint}-x-profile`,
      tokenAddress: mint,
      sourceType: 'project',
      authorName: ticker,
      authorHandle: handle,
      avatarUrl: null,
      timestamp: null,
      text: 'Public X profile linked on the token record — useful for official narrative and catalyst posts.',
      url,
      engagement: null,
      relevanceScore: 0.35,
      sourceWeight: 0.6,
      catalystType: 'official' satisfies SocialCatalystType,
    });
  }
  const web = token.website_url?.trim();
  if (web) {
    out.push({
      id: `${mint}-site`,
      tokenAddress: mint,
      sourceType: 'project',
      authorName: ticker,
      authorHandle: null,
      avatarUrl: null,
      timestamp: null,
      text: `Project site (${web.replace(/^https?:\/\//i, '').slice(0, 72)})`,
      url: web.startsWith('http') ? web : `https://${web}`,
      engagement: null,
      relevanceScore: 0.2,
      sourceWeight: 0.35,
      catalystType: 'narrative_driver',
    });
  }
  return out;
}

function demoWalletJitter(mint: string): number {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = (Math.imul(h, 31) + mint.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function launchPadLooksLikeVenue(launchPad: string | null): boolean {
  if (!launchPad) return false;
  const p = launchPad.toLowerCase();
  return p.includes('pump') || p.includes('meteora') || p.includes('zora') || p.includes('dedust');
}

function pickBadges(
  volPct: number,
  socialS: number,
  riskS: number,
  ctx: {
    isDemo: boolean;
    launchPad: string | null;
    trackedWalletBuys: number | null;
    freshWalletBuys: number | null;
    kolMentionCount: number | null;
  },
): ExploreSignalBadge[] {
  const acc = new Set<ExploreSignalBadge>();
  if (volPct >= 0.62) acc.add('volume');
  if (socialS >= 16) acc.add('social');
  if (riskS >= 62) acc.add('risk');
  if (ctx.isDemo) {
    if ((ctx.trackedWalletBuys ?? 0) >= 70) acc.add('wallets');
    if ((ctx.freshWalletBuys ?? 0) >= 20) acc.add('fresh');
    if ((ctx.kolMentionCount ?? 0) >= 10) acc.add('kol');
    else if ((ctx.kolMentionCount ?? 0) >= 4 && socialS >= 18) acc.add('kol');
    if (launchPadLooksLikeVenue(ctx.launchPad)) acc.add('listing');
  }
  return [...acc];
}

/** Build percentile-blended composite mindshare scores for the whole cohort */
export function buildExploreItems(params: {
  bundles: PulseTokenBundle[];
  chainTicker: string;
  timeWindow: ExploreTimeWindow;
  weights?: MindshareWeightConfig;
}): TokenExploreItem[] {
  const { bundles, chainTicker, timeWindow } = params;
  const weights = params.weights ?? DEFAULT_MINDSHARE_WEIGHTS;
  const list = bundles.filter((b) => b.snapshot);
  const mcapVals = list
    .map((b) => (b.snapshot?.market_cap_usd != null ? Number(b.snapshot.market_cap_usd) : 0))
    .filter((n) => Number.isFinite(n));
  const liqVals = list
    .map((b) => (b.snapshot?.liquidity_usd != null ? Number(b.snapshot.liquidity_usd) : 0))
    .filter((n) => Number.isFinite(n));
  const volVals = list.map((b) => pickVolumeUsd(b.snapshot, timeWindow) ?? 0);

  const volRatios = list.map((b) => {
    const vw = pickVolumeUsd(b.snapshot, timeWindow);
    const v24 = b.snapshot?.volume_24h_usd != null ? Number(b.snapshot.volume_24h_usd) : null;
    if (vw == null || !Number.isFinite(vw) || v24 == null || !Number.isFinite(v24) || v24 < 500) {
      return 0;
    }
    const wh = Math.max(windowHours(timeWindow), 1e-6);
    const expected = v24 / 24 * wh;
    return expected > 0 ? vw / expected : 0;
  });

  const out: TokenExploreItem[] = list.map((bundle, idx) => {
    const snapshot = bundle.snapshot!;
    const { token } = bundle;
    const mint = token.mint;
    const ticker = token.symbol?.trim() || token.name?.trim() || mint.slice(0, 8);
    const name = token.name?.trim() || ticker;

    const mcap =
      snapshot.market_cap_usd != null && Number.isFinite(Number(snapshot.market_cap_usd))
        ? Number(snapshot.market_cap_usd)
        : null;
    const liq =
      snapshot.liquidity_usd != null && Number.isFinite(Number(snapshot.liquidity_usd))
        ? Number(snapshot.liquidity_usd)
        : null;
    const v24 =
      snapshot.volume_24h_usd != null && Number.isFinite(Number(snapshot.volume_24h_usd))
        ? Number(snapshot.volume_24h_usd)
        : null;
    const vWin = pickVolumeUsd(snapshot, timeWindow);
    const txnWin = pickTxnCount(snapshot, timeWindow);

    const mPct = cohortPercentile(mcapVals, mcap ?? 0);
    const lPct = cohortPercentile(liqVals, liq ?? 0);
    const vPct = cohortPercentile(volVals, vWin ?? 0);
    const txnAll = list
      .map((x) => pickTxnCount(x.snapshot, timeWindow))
      .filter((x): x is number => x != null && Number.isFinite(x));
    const tRank = txnWin != null && txnAll.length ? cohortPercentile(txnAll, txnWin) : 0;

    const marketBlend = clamp(100 * (0.34 * vPct + 0.28 * lPct + 0.26 * mPct + 0.12 * tRank), 0, 100);

    const selfRatio = volRatios[idx] ?? 0;
    const cohortRatios = volRatios.filter((r) => Number.isFinite(r));
    const socialS = socialPresenceScore(bundle);

    const snapIdNum = snapshot.id != null ? Number(snapshot.id) : NaN;
    const isDemoFixture = Number.isFinite(snapIdNum) && snapIdNum < 0;
    const dj = demoWalletJitter(mint);

    let walletScore = 0;
    let eventScore = 0;
    let trackedWalletBuys: number | null = null;
    let freshWalletBuys: number | null = null;
    let kolMentionCount: number | null = null;
    let socialVelocity: number | null = null;

    if (isDemoFixture) {
      walletScore = clamp(22 + (dj % 56) + (socialS >= 20 ? 12 : 0), 0, 100);
      eventScore =
        token.launch_pad && launchPadLooksLikeVenue(token.launch_pad)
          ? 34 + (dj % 30)
          : token.launch_pad
            ? 14 + (dj % 26)
            : 5 + (dj % 20);
      trackedWalletBuys = 32 + (dj % 210);
      freshWalletBuys = 5 + (dj % 55);
      kolMentionCount = Math.min(24, Math.floor((dj % 140) / 8));
      socialVelocity = Math.round((dj % 85) / 10);
    }

    const mScore = momentumScore(cohortRatios.length ? cohortRatios : [0], selfRatio);

    const riskS = riskScoreFromSnapshot(snapshot);
    const compositeRaw =
      weights.social * socialS +
      weights.wallet * walletScore +
      weights.market * marketBlend +
      weights.event * eventScore +
      weights.momentum * mScore;

    const riskPenalty = weights.riskPenaltyMax * riskS * 100;
    const mindshare = clamp(compositeRaw - riskPenalty, 0, 100);

    const trend = trendFromMomentum(mScore);
    const accent = pickAccent(socialS, riskS, trend, eventScore);

    const liqRatioMc =
      liq != null && mcap != null && mcap > 500 ? Math.min(liq / mcap, 2) : liq ? 0.12 : 0;

    const badges = pickBadges(vPct, socialS, riskS, {
      isDemo: isDemoFixture,
      launchPad: token.launch_pad,
      trackedWalletBuys,
      freshWalletBuys,
      kolMentionCount,
    });

    let ageHours: number | null = null;
    if (token.created_at) {
      ageHours = differenceInHours(new Date(), new Date(token.created_at));
    }
    let ageLabel: string | null = null;
    if (ageHours != null && Number.isFinite(ageHours)) {
      if (ageHours < 24) ageLabel = `${Math.max(1, Math.round(ageHours))}h`;
      else ageLabel = `${Math.round(ageHours / 24)}d`;
    }

    const topSources = buildSocialSources(bundle);

    /* Reason text — factual, no invented social spikes */
    const parts: string[] = [];
    if (socialS >= 22) parts.push(`has public presence signals (${socialS === 36 ? 'strong' : 'light'}) linking social and web`);
    parts.push(`${timeWindow.toUpperCase()} volume ranks near the cohort ${Math.round(vPct * 100)}th percentile`);

    parts.push(`liquidity ${liqRatioMc >= 0.08 ? 'supports' : 'partially supports'} the current market cap structure`);
    if (trend === 'rising') parts.push('short-horizon activity is running ahead of the 24h average');
    else if (trend === 'falling') parts.push('short-horizon activity is trailing the 24h average');
    if (riskS >= 62) parts.push('concentration / structural risk reads elevated on available holder data');
    const reasonSummary = `${ticker} appears on Explore because ${parts.join('; ')}. Wallet and influencer feeds will sharpen this narrative when connected.`;

    const demoHint =
      isDemoFixture && (trackedWalletBuys != null || kolMentionCount != null || freshWalletBuys != null)
        ? ' Demo scenario: modeled wallet/KOL deltas for UI only.'
        : '';
    const hoverOneLiner =
      trend === 'rising'
        ? `Liquidity + ${timeWindow} volume skew hot; narrative follows flow.${socialS >= 18 ? ' Social wired.' : ''}${demoHint}`
        : `Flows vs structure: liquidity, ${timeWindow} volume, and holder risk.${socialS >= 18 ? ' Social handles linked.' : ''}${demoHint}`;

    const topCatalysts: string[] = [];
    if (vPct >= 0.82) topCatalysts.push('Heavy relative volume for this window');
    if (socialS >= 22) topCatalysts.push('Linked social endpoints');
    if (riskS >= 60) topCatalysts.push('Structural risk worth monitoring');
    if (isDemoFixture) {
      if ((trackedWalletBuys ?? 0) > 100) topCatalysts.push('Simulated tracked-wallet attention (demo)');
      if ((freshWalletBuys ?? 0) > 35) topCatalysts.push('Fresh wallet cadence modeled (demo)');
      if ((kolMentionCount ?? 0) > 10) topCatalysts.push('KOL chatter synthetic (demo)');
    }

    return {
      tokenAddress: mint,
      chainTicker,
      ticker,
      name,
      iconUrl: token.image_url,
      ageHours,
      ageLabel,
      marketCap: mcap,
      liquidity: liq,
      volumeWindow: vWin,
      volume24h: v24,
      txnsWindow: txnWin,
      buySellRatio: null,
      priceChangePct: null,
      sparkline: null,
      mindshareScore: Math.round(mindshare * 10) / 10,
      marketScore: Math.round(marketBlend * 10) / 10,
      walletScore,
      socialScore: socialS,
      eventScore,
      momentumScore: mScore,
      riskScore: riskS,
      confidenceLevel: confidenceFrom(snapshot),
      trendDirection: trend,
      trackedWalletBuys,
      freshWalletBuys,
      smartWalletBuys: isDemoFixture ? Math.max(1, Math.round((trackedWalletBuys ?? 0) * 0.38)) : null,
      kolMentionCount,
      socialVelocity,
      topCatalysts,
      topSources,
      reasonSummary,
      hoverOneLiner,
      bubbleAccent: accent,
      signalBadges: badges,
      lastUpdatedAt: snapshot.snapshot_at ?? null,
      displayRadius: 72,
      isDemoFixture,
    };
  });

  /** Second pass radii — log scaled toward premium bubble hierarchy */
  const mindshares = out.map((o) => o.mindshareScore);
  const minM = Math.min(...mindshares);
  const maxM = Math.max(...mindshares);
  const maxRAllowed = 93;
  const minR = 41;
  out.forEach((o) => {
    const norm = maxM <= minM ? 0.5 : (o.mindshareScore - minM) / (maxM - minM);
    const logT = Math.log10(1 + norm * 9) / Math.log10(10);
    o.displayRadius = Math.round(minR + logT * (maxRAllowed - minR));
  });

  return out;
}

export function sortExploreItems(items: TokenExploreItem[], mode: ExploreSortMode): TokenExploreItem[] {
  const copy = [...items];
  const by = (sel: (i: TokenExploreItem) => number) => copy.sort((a, b) => sel(b) - sel(a));

  switch (mode) {
    case 'mindshare':
      return by((i) => i.mindshareScore);
    case 'volume':
      return by((i) => i.volumeWindow ?? i.volume24h ?? 0);
    case 'wallets':
      return by((i) =>
        i.trackedWalletBuys ??
        i.smartWalletBuys ??
        i.walletScore + (i.marketScore + i.momentumScore) / 160,
      );
    case 'fresh_wallets':
      return by((i) => i.freshWalletBuys ?? i.momentumScore);
    case 'kols':
      return by((i) => i.kolMentionCount ?? i.socialScore + i.momentumScore / 120);
    case 'new_pairs':
      return copy.sort((a, b) => {
        const ah = a.ageHours ?? Number.POSITIVE_INFINITY;
        const bh = b.ageHours ?? Number.POSITIVE_INFINITY;
        return ah - bh;
      });
    default:
      return by((i) => i.mindshareScore);
  }
}

export function applyExploreFilters(items: TokenExploreItem[], filters: ExploreFilterState) {
  return items.filter((i) => {
    if (filters.minMcapUsd != null && (i.marketCap ?? 0) < filters.minMcapUsd) return false;
    if (filters.maxMcapUsd != null && (i.marketCap ?? Infinity) > filters.maxMcapUsd) return false;
    if (filters.minLiquidityUsd != null && (i.liquidity ?? 0) < filters.minLiquidityUsd) return false;
    if (filters.minVolumeUsd != null && (i.volumeWindow ?? i.volume24h ?? 0) < filters.minVolumeUsd) return false;
    if (filters.minMindshare != null && i.mindshareScore < filters.minMindshare) return false;
    if (filters.minWalletSignal != null) {
      const w = i.trackedWalletBuys ?? i.walletScore ?? 0;
      if (w < filters.minWalletSignal) return false;
    }
    if (filters.maxRisk != null && i.riskScore > filters.maxRisk) return false;
    if (filters.excludeHighRisk && i.riskScore >= 72) return false;
    if (filters.onlyNewPairsHours != null) {
      if (i.ageHours == null || i.ageHours > filters.onlyNewPairsHours) return false;
    }
    if (filters.onlySocialSignals && i.socialScore < 16) return false;
    return true;
  });
}
