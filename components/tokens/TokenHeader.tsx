'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { Bell, ExternalLink, Search, Share2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/shared/CopyButton';
import { PulseTokenAvatarHover } from '@/components/tokens/PulseTokenAvatarHover';
import { PulseRowSocialStrip } from '@/components/tokens/PulseRowSocialStrip';
import { QuotePairBadge } from '@/components/tokens/QuotePairBadge';
import { TokenHeaderNameHover } from '@/components/tokens/TokenHeaderNameHover';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { RiskFlags } from '@/components/tokens/RiskFlags';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import { getPulseRowTraitFlags } from '@/lib/tokens/pumpTokenSignals';
import { enrichBundleTwitterFromSocialModel } from '@/lib/tokens/pulseSocialLinks';
import {
  resolveLaunchpadAvatarChrome,
  resolveLaunchpadAvatarChromeWithFallback,
} from '@/lib/tokens/launchpadAvatarChrome';
import { alternateQuotePairKind } from '@/lib/tokens/quoteToken';
import {
  extractGlobalFeesSol,
  formatSupplyHint,
} from '@/lib/tokens/metadataHints';
import { resolveTokenSupplyUi } from '@/lib/tokens/supplyUi';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  formatAgeShort,
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatPriceUsd,
} from '@/lib/utils/formatters';
import type { Tables } from '@/lib/supabase/types';
import type { TokenMarketSnapshotRow, TokenRow } from '@/lib/db/tokens';
import { cn } from '@/lib/utils/cn';
import { useTokenExtendedMetrics } from '@/lib/hooks/useTokenExtendedMetrics';
import { TokenSupplyRefreshControl } from '@/components/tokens/TokenSupplyRefreshControl';
import { DESK_FIELD_TOOLTIPS } from '@/lib/tokens/deskFieldTooltips';
import { headerStatValueClass } from '@/lib/tokens/tokenDeskRisk';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { openAlertRulesModal } from '@/components/alerts/AlertRulesModal';
import { explorerTokenAriaLabel, explorerTokenHrefFromMint } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useUIStore } from '@/store/ui';
import { useWatchlistStore } from '@/store/watchlist';
import { noteRecentTokenVisit } from '@/store/recentTokenVisits';
import { TokenSharePnlButton } from '@/components/tokens/TokenSharePnlButton';
import { useTokenDeskSharePnl } from '@/lib/hooks/useTokenDeskSharePnl';

const iconRow =
  'inline-flex h-4 w-4 shrink-0 cursor-pointer text-fg-muted transition-colors hover:text-fg-primary';

/** Axiom-scale identity column on token detail header. */
const HEADER_AVATAR_PX = 48;
const HEADER_SOCIAL_GLYPH_PX = 21;
const HEADER_PROFILE_GLYPH_PX = 25;

function pickPriceChange24hPct(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['priceChange24hPct', 'price_change_24h_pct', 'chg24hPct', 'change24hPct'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/%/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickAthMultiplier(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['athMultiple', 'ath_multiple', 'athX', 'ath_x'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/x$/i, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickAthUsd(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['athUsd', 'ath_usd', 'ath_price_usd', 'allTimeHighUsd'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,]/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function TokenHeader({
  token,
  snapshot,
  mint,
}: {
  token: TokenRow;
  snapshot: TokenMarketSnapshotRow | null;
  mint: string;
}) {
  const ticker = token.symbol ?? '???';
  const name = token.name ?? 'Unknown';
  const now = useLiveClock();

  const bundle = useMemo(
    () => enrichBundleTwitterFromSocialModel({ token, snapshot }),
    [token, snapshot],
  );
  const bonding = getPulseBondingRingState(bundle);
  const supplyRaw = resolveTokenSupplyUi(token.raw_metadata, token.decimals, {
    marketCapUsd: snapshot?.market_cap_usd,
    priceUsd: snapshot?.price_usd,
  });
  const supplyLabel = formatSupplyHint(supplyRaw);
  const feesSol = extractGlobalFeesSol(snapshot?.extended_metrics);
  const extJson = snapshot?.extended_metrics;

  const { metrics: headerMetrics } = useTokenExtendedMetrics(mint);
  const proTraders = headerMetrics.proTraders ?? null;

  const activeChain = useUIStore((s) => s.activeChain);
  const traits = useMemo(() => getPulseRowTraitFlags(bundle), [bundle]);
  const alternateQuote = useMemo(
    () => alternateQuotePairKind(bundle, activeChain),
    [bundle, activeChain],
  );
  const launchpadChrome = useMemo(() => {
    const opts = {
      showFrame: true,
      isMigrated: bonding.migrated,
      pumpFunOnBondingCurve: traits.pumpFunBonding,
      chain: activeChain,
    };
    return bonding.migrated
      ? resolveLaunchpadAvatarChromeWithFallback(bundle, opts)
      : resolveLaunchpadAvatarChrome(bundle, opts);
  }, [bundle, bonding.migrated, traits.pumpFunBonding, activeChain]);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const xMonitorOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const watchlisted = useWatchlistStore((s) => s.items.some((i) => i.mint === mint));
  const toggleWatchlist = useWatchlistStore((s) => s.toggleItem);
  const setShowTicker = useWatchlistStore((s) => s.setShowTicker);
  const setTickerMode = useWatchlistStore((s) => s.setTickerMode);
  const nativeSym = nativeTicker(activeChain);

  const { canShare: canSharePnl, openShareComposer } = useTokenDeskSharePnl({
    mint,
    decimals: token.decimals ?? 6,
    tokenTicker: ticker,
    tokenName: name,
    tokenIconUrl: token.image_url,
    chain: activeChain,
    priceUsd: snapshot?.price_usd,
  });

  useEffect(() => {
    noteRecentTokenVisit({
      mint,
      symbol: token.symbol,
      name: token.name,
      imageUrl: token.image_url,
      marketCapUsd: snapshot?.market_cap_usd ?? null,
    });
  }, [mint, token.symbol, token.name, token.image_url, snapshot?.market_cap_usd]);

  const priceChangePct = pickPriceChange24hPct(extJson);
  const athUsd = pickAthUsd(extJson);
  const athMult = pickAthMultiplier(extJson);
  const focalPrimary = useMemo(() => {
    if (snapshot?.market_cap_usd != null && Number.isFinite(snapshot.market_cap_usd)) {
      return formatCompactUsd(snapshot.market_cap_usd);
    }
    const px = formatPriceUsd(snapshot?.price_usd);
    return px !== '\u2014' ? px : '\u2014';
  }, [snapshot]);

  const bondingValue =
    bonding.fillPct != null ? formatPercent(bonding.fillPct, { decimals: 1 }) : '\u2014';

  const priceStr = formatPriceUsd(snapshot?.price_usd);
  const liquidityStr = formatCompactUsd(snapshot?.liquidity_usd);
  const supplyDisplay = supplyLabel ?? '\u2014';
  const feesDisplay =
    feesSol != null ? `${formatNumber(feesSol, { decimals: 3 })} ${nativeSym}` : '\u2014';
  const athPrimary = athUsd != null ? formatCompactUsd(athUsd) : '\u2014';

  const holdersValue =
    headerMetrics.holders != null
      ? formatNumber(headerMetrics.holders, { decimals: 0 })
      : snapshot?.holder_count != null
        ? formatNumber(snapshot.holder_count, { decimals: 0 })
        : '\u2014';

  const prosValue =
    proTraders != null ? String(proTraders) : '\u2014';
  const prosMuted = prosValue === '\u2014' || prosValue === '0';

  const athSub =
    athMult != null && Number.isFinite(athMult) && athPrimary !== '\u2014'
      ? `${athMult.toFixed(1)}x`
      : undefined;

  const shareTokenLink = useCallback(async () => {
    const url = `${window.location.origin}/token/${encodeURIComponent(mint)}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `${ticker} on Pointer`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      /* user dismissed share sheet */
    }
  }, [mint, ticker]);

  const liquidityUsd = snapshot?.liquidity_usd ?? null;
  const snapshotAt = snapshot?.snapshot_at ?? null;

  const stats: {
    label: string;
    value: string;
    accent?: boolean;
    prosMuted?: boolean;
    showRefresh?: boolean;
    missingTooltip?: string;
    sub?: string;
  }[] = [
    { label: 'Price', value: priceStr },
    {
      label: 'Liquidity',
      value: liquidityStr,
      showRefresh: true,
      missingTooltip: DESK_FIELD_TOOLTIPS.liquidity,
    },
    {
      label: 'Supply',
      value: supplyDisplay,
      showRefresh: true,
      missingTooltip: DESK_FIELD_TOOLTIPS.supply,
    },
    { label: 'Fees', value: feesDisplay, missingTooltip: DESK_FIELD_TOOLTIPS.fees },
    { label: 'Bonding', value: bondingValue, accent: true, missingTooltip: DESK_FIELD_TOOLTIPS.bonding },
    {
      label: 'ATH',
      value: athPrimary,
      sub: athSub,
      missingTooltip: DESK_FIELD_TOOLTIPS.ath,
    },
    { label: 'Holders', value: holdersValue },
    { label: 'Pros', value: prosValue, prosMuted, missingTooltip: DESK_FIELD_TOOLTIPS.pros },
  ];

  return (
    <div className="relative z-20 min-w-0 overflow-visible border-b border-white/[0.06] bg-bg-raised font-sans">
      <div className="flex min-w-0 items-center overflow-visible px-2.5 sm:px-3">
        <div className="flex shrink-0 items-center gap-2 py-2.5">
          <div className="relative shrink-0 overflow-visible pr-1.5 pb-1.5">
            <PulseTokenAvatarHover
              bundle={bundle}
              size={HEADER_AVATAR_PX}
              showRing
              launchpadChrome={launchpadChrome}
              ringPresentation="brand-full"
              cornerBadgeEmphasis="header"
              avatarImagePriority
              className="shrink-0"
            />
          </div>

          <div className="flex shrink-0 flex-col justify-center gap-0.5 overflow-visible">
            <div className="flex shrink-0 items-center gap-1.5 overflow-visible">
              <TokenHeaderNameHover ticker={ticker} name={name} mint={mint} />
              <CopyButton
                value={mint}
                toastLabel="Mint copied"
                label="Copy mint"
                iconOnly
                iconClassName="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-fg-muted transition-colors hover:text-fg-primary"
              />
              <button
                type="button"
                className={cn(iconRow, 'rounded-sm')}
                aria-label="Share token"
                onClick={() => void shareTokenLink()}
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={cn(iconRow, watchlisted && 'text-accent-primary')}
                aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                onClick={() => {
                  const wasWatchlisted = watchlisted;
                  toggleWatchlist({
                    mint,
                    symbol: token.symbol,
                    name: token.name,
                    imageUrl: token.image_url,
                    marketCapUsd: snapshot?.market_cap_usd ?? null,
                  });
                  if (!wasWatchlisted) {
                    setShowTicker(true);
                    setTickerMode('watchlist');
                    toast.success('Added to watchlist');
                  } else {
                    toast.message('Removed from watchlist');
                  }
                }}
              >
                <Star className="h-3.5 w-3.5" strokeWidth={2} fill={watchlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="flex min-w-0 items-center gap-2 overflow-visible">
              <span className="shrink-0 text-[11px] font-semibold tabular-nums leading-none text-signal-bull">
                {formatAgeShort(token.created_at, now)}
              </span>
              {alternateQuote != null ? (
                <QuotePairBadge kind={alternateQuote} chain={activeChain} variant="header" />
              ) : null}
              <PulseRowSocialStrip
                bundle={bundle}
                compact
                inlineHeader
                glyphSize={HEADER_SOCIAL_GLYPH_PX}
                profileGlyphSize={HEADER_PROFILE_GLYPH_PX}
                showTxCount={false}
                showDevWallet={false}
                showHoldersCommunity={true}
                showProTradersStat={false}
                showDevCrownStat={false}
                fallbackXSearchQuery={name.trim() || ticker}
                showTwitterFooter={false}
                traits={traits}
                chain={activeChain}
              />
              {canSharePnl ? (
                <>
                  <span className="h-3 w-px shrink-0 bg-white/[0.08]" aria-hidden />
                  <TokenSharePnlButton onClick={openShareComposer} />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mx-2.5 hidden h-9 w-px shrink-0 bg-white/[0.08] sm:block" aria-hidden />

        <div className="scrollbar-thin flex min-w-0 flex-1 items-end overflow-x-auto py-2">
          <div className="flex shrink-0 items-end gap-3 sm:gap-4">
            <div className="flex shrink-0 flex-col justify-end gap-1">
              <span className="text-[1.25rem] font-bold tabular-nums leading-none tracking-tight text-fg-primary sm:text-[1.375rem]">
                {focalPrimary}
              </span>
              {priceChangePct != null ? (
                <span
                  className={cn(
                    'mt-1 text-[10px] font-medium tabular-nums leading-none',
                    priceChangePct >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {priceChangePct >= 0 ? '+' : ''}
                  {priceChangePct.toFixed(2)}%
                </span>
              ) : null}
            </div>

            <div className="hidden h-5 w-px shrink-0 bg-white/[0.08] sm:block" aria-hidden />

            <div className="flex shrink-0 items-end gap-x-3 sm:gap-x-4">
            {stats.map((stat) => {
              const mutedBase =
                stat.value === '\u2014' || stat.value === '\u2026' || stat.value === '';

              const valueClassName = headerStatValueClass(stat.label, stat.value, {
                liquidityUsd,
                accent: stat.accent,
                prosMuted: stat.prosMuted,
              });

              const sub = stat.sub;

              const valueNode = mutedBase && stat.missingTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'cursor-help border-b border-dotted border-fg-muted/30',
                        valueClassName,
                      )}
                    >
                      {stat.value}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-[10px] leading-snug">
                    {stat.missingTooltip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                stat.value
              );

              return (
                <div key={stat.label} className="flex min-w-[3.25rem] shrink-0 flex-col gap-1">
                  <span className="inline-flex h-5 items-center gap-0.5 whitespace-nowrap text-[10px] font-medium uppercase leading-none tracking-[0.06em] text-fg-muted/85">
                    {stat.label}
                    {stat.showRefresh ? (
                      <TokenSupplyRefreshControl mint={mint} lastRefreshedAt={snapshotAt} />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'inline-flex min-h-[14px] items-baseline gap-1 whitespace-nowrap text-[13px] font-semibold tabular-nums leading-none sm:text-[14px]',
                      valueClassName,
                    )}
                  >
                    {valueNode}
                    {sub ? (
                      <span className="text-[10px] font-medium tabular-nums leading-none text-signal-bull">
                        {sub}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-center py-2 pl-1">
          {launchpadChrome || !token.launch_pad || token.launch_pad === 'pump.fun' ? null : (
            <LaunchpadBadge launchPad={token.launch_pad} />
          )}
          <LaunchpadSubBadges token={token} snapshot={snapshot} variant="detail" />
          <RiskFlags token={token as Tables<'tokens'>} snapshot={snapshot} className="shrink-0" />
          <span className="hidden h-4 w-px shrink-0 bg-border-subtle/50 sm:inline-block" aria-hidden />
          <button
            type="button"
            className={cn(iconRow, 'rounded-sm')}
            aria-label="Search token"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => openAlertRulesModal()}
            className={cn(
              iconRow,
              'rounded-sm',
              xMonitorOpen && 'text-accent-primary',
            )}
            aria-label="Open Pulse alerts"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <a
            href={explorerTokenHrefFromMint(mint, activeChain)}
            target="_blank"
            rel="noreferrer"
            className={cn('focus-ring inline-flex shrink-0 rounded-sm', iconRow)}
            aria-label={explorerTokenAriaLabel(activeChain)}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}
