'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Eye, Loader2, Zap } from 'lucide-react';
import { PulseRowSocialStrip } from '@/components/tokens/PulseRowSocialStrip';
import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import { PulseTokenAvatar } from '@/components/tokens/PulseTokenAvatar';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { RiskFlags } from '@/components/tokens/RiskFlags';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { syntheticPulseVolMc } from '@/lib/dev/demoTokenFixtures';
import type { BuyButtonStyle, ColumnDisplayOptions } from '@/lib/tokens/columnPresetModel';
import { getPulseRowTraitFlags } from '@/lib/tokens/pumpTokenSignals';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatAgeShort } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseRowDensity } from '@/store/pulseColumns';
import type { PulseTokenBundle } from '@/types/tokens';

type UltraActionKey = 'primaryBuy' | 'secondBuy' | 'secondSell';

export function TokenRow({
  bundle,
  density = 'normal',
  display,
  quickBuySol,
  buyButtonStyle = 'medium',
  onPulseQuickBuy,
  onPulseSecondBuy,
  onPulseQuickSell,
  pulseBuyBusy = false,
  pulseBuyDisabled = false,
  columnId,
  /** Fixed pixel height from Pulse virtualizer â€” keeps every row the same size. */
  slotHeight,
  /** Native quote for quick-buy chip (TON / SOL / â€¦). */
  quoteSymbol = 'TON',
}: {
  bundle: PulseTokenBundle;
  density?: PulseRowDensity;
  display?: ColumnDisplayOptions;
  quickBuySol?: number;
  buyButtonStyle?: BuyButtonStyle;
  /** Execute swap for this rowâ€™s mint using column header amount (labelled by `quoteSymbol`). */
  onPulseQuickBuy?: () => void;
  /** Second quick-buy (left of primary). Uses `display.secondQuickBuySol`. */
  onPulseSecondBuy?: () => void;
  /** Percent sell when `display.pulseSecondButton === 'sell_pct'`. */
  onPulseQuickSell?: () => void;
  pulseBuyBusy?: boolean;
  pulseBuyDisabled?: boolean;
  /** Pulse board column (bonding ring semantics / gold on migrated lane). */
  columnId?: PulseColumnId;
  slotHeight?: number;
  quoteSymbol?: string;
}) {
  const router = useRouter();
  const { token, snapshot } = bundle;
  const trackPulseFlashMint = useUIStore((s) => s.trackPulseHighlightMint);
  const pulseFlashHighlight =
    Boolean(trackPulseFlashMint) && token.mint === trackPulseFlashMint;

  const demoMetrics = useMemo(
    () => syntheticPulseVolMc(token.mint),
    [token.mint],
  );
  const { isTracked, labelFor } = useTrackedWalletsLookup();

  const hoverProps = useEntityHover(
    useMemo(
      () => ({
        type: 'token' as const,
        id: token.mint,
        label: token.symbol ?? token.name ?? undefined,
      }),
      [token.mint, token.symbol, token.name],
    ),
  );

  const ticker = token.symbol ?? '???';
  const name = token.name ?? 'Unknown';
  const volRaw = snapshot?.volume_24h_usd ?? snapshot?.volume_1h_usd;
  const vol =
    volRaw != null && Number.isFinite(volRaw) ? volRaw : demoMetrics.volUsd;
  const mcUsd =
    snapshot?.market_cap_usd != null && Number.isFinite(snapshot.market_cap_usd)
      ? snapshot.market_cap_usd
      : demoMetrics.mcUsd;

  const showMc = display?.showMc ?? true;
  const showLiq = display?.showLiq ?? true;
  const showVol = display?.showVol ?? true;
  const showHolders = display?.showHolders ?? true;
  const showDev = display?.showDev ?? true;
  const showRing = display?.showBondingRing ?? true;
  const showBadge = display?.showLaunchpadBadge ?? true;
  const showRisk = display?.showRiskFlags ?? true;
  const mcLayout = display?.mcLayout ?? 'strip';
  const showPumpFrame = display?.showPumpFrame ?? true;
  const showTraitIcons = display?.showTraitIcons ?? true;
  const heroMc = mcLayout === 'hero' && showMc;
  const traits = useMemo(() => getPulseRowTraitFlags(bundle), [bundle]);
  const pumpFrameActive = showPumpFrame && traits.pumpFunBonding;

  /** Pulse virtualizer rows use a single locked footprint; ignore per-preset density there. */
  const layoutDensity: PulseRowDensity = slotHeight != null ? 'normal' : density ?? 'normal';

  /** Locked to h-10 w-10 (40px) across every column for consistent visual rhythm. */
  const avatarSize = 40;
  const rowMinH =
    layoutDensity === 'compact'
      ? 'min-h-[68px]'
      : layoutDensity === 'expanded'
        ? 'min-h-[92px]'
        : 'min-h-[76px]';
  const py =
    layoutDensity === 'compact' ? 'py-2' : layoutDensity === 'expanded' ? 'py-3' : 'py-2.5';
  const effectivePy = slotHeight != null ? 'py-1' : py;

  const devWallet = token.creator_wallet;
  const trackedDev =
    !!devWallet && showDev && isTracked(devWallet);
  const trackedDevLabel = trackedDev ? labelFor(devWallet) : null;
  const ultraChrome = buyButtonStyle === 'ultra';
  const secondMode = display?.pulseSecondButton ?? 'none';
  const secondBuySol = display?.secondQuickBuySol ?? 2;
  const secondSellPct = display?.secondSellPct ?? 25;
  const volMcLayout =
    slotHeight != null && buyButtonStyle === 'small' ? 'stack' : 'inline';
  const showSecondBuy = secondMode === 'buy' && secondBuySol > 0;
  const showSecondSell = secondMode === 'sell_pct';
  const canQuickBuy =
    quickBuySol != null && Number.isFinite(quickBuySol) && quickBuySol > 0;
  const hasPrimaryBuy = canQuickBuy && quickBuySol != null;
  const hasSecondSlot = showSecondBuy || showSecondSell;
  /** Left / right 50–50 strip under metrics (Axiom-style dual presets). */
  const splitPairStrip = hasPrimaryBuy && hasSecondSlot;
  /** Filled quick-buy chrome when not in Ultra (Ultra uses outline-only buttons). */
  const filledBuyStyle: Exclude<BuyButtonStyle, 'ultra'> =
    buyButtonStyle === 'ultra' ? 'medium' : buyButtonStyle;
  const [activeUltraAction, setActiveUltraAction] = useState<UltraActionKey | null>(null);

  useEffect(() => {
    if (!pulseBuyBusy) setActiveUltraAction(null);
  }, [pulseBuyBusy]);

  const showPumpCorner = token.launch_pad === 'pump.fun';

  /** Uniform `XXXX…XXXX` caption — same length per row, grey at 70% so it reads as metadata, not chrome. */
  const mintCaption = (
    <span
      className="block w-[5.25rem] truncate text-center font-mono tabular-nums text-[9px] leading-tight text-fg-muted/70"
      title={token.mint}
    >
      {shortenAddress(token.mint, 4)}
    </span>
  );

  const avatarStack = (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <PulseTokenAvatar
        bundle={bundle}
        size={avatarSize}
        showRing={showRing}
        pumpFrame={pumpFrameActive}
        launchpadCorner={showPumpCorner}
        columnId={columnId}
      />
      {mintCaption}
    </div>
  );

  const onQuickBuy = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    triggerQuickBuy();
  };

  function triggerQuickBuy() {
    if (pulseBuyDisabled || pulseBuyBusy) return;
    if (quickBuySol == null || !Number.isFinite(quickBuySol) || quickBuySol <= 0) return;
    setActiveUltraAction('primaryBuy');
    onPulseQuickBuy?.();
  }

  const tokenPath = `/token/${token.mint}`;
  const nameTitle = `${ticker} â€” ${name}`;

  const isInteractiveClickTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'a,button,input,select,textarea,[role="button"],[data-row-click-skip="true"]',
      ),
    );

  const openToken = () => {
    router.push(tokenPath);
  };

  const onTokenAreaClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveClickTarget(e.target)) return;
    openToken();
  };

  const onTokenAreaKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || isInteractiveClickTarget(e.target)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openToken();
  };

  /** Single primary line: ticker + full name never wrap (Axiom-style). */
  const nameCluster = (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
      <p className="min-w-0 flex-1 truncate leading-tight" title={nameTitle}>
        <span className="text-sm font-semibold text-fg-primary">{ticker}</span>
        <span className="ml-1.5 text-xs text-fg-secondary">{name}</span>
      </p>
      {showBadge ? (
        <span className="inline-flex max-w-[min(11rem,42%)] shrink-0 flex-nowrap items-center gap-1 overflow-hidden">
          {token.launch_pad !== 'pump.fun' ? <LaunchpadBadge launchPad={token.launch_pad} /> : null}
          <LaunchpadSubBadges
            bundle={bundle}
            variant={layoutDensity === 'expanded' ? 'detail' : 'inline'}
          />
        </span>
      ) : null}
      {trackedDev ? (
        <span
          className="inline-flex max-w-[6.5rem] shrink-0 items-center gap-0.5 truncate rounded border border-accent-primary/35 bg-accent-primary/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-primary"
          title={
            trackedDevLabel
              ? `Dev is tracked: ${trackedDevLabel}`
              : 'Dev wallet is on your trackers list'
          }
        >
          <Eye className="h-2.5 w-2.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
          <span className="truncate">{trackedDevLabel ? trackedDevLabel : 'Tracked'}</span>
        </span>
      ) : null}
    </div>
  );

  const identityCluster = nameCluster;
  /**
   * Terminal-style age chip. Lives on the LEFT of the icon strip (was top-right of name row).
   * Recent (<60s) gets the green seconds tint Terminal uses to flag fresh listings.
   */
  const ageLabel = formatAgeShort(token.created_at);
  const ageBadge = (
    <span className="shrink-0 whitespace-nowrap leading-none text-xs text-fg-muted">
      {ageLabel}
    </span>
  );

  const volMcSize =
    layoutDensity === 'compact'
      ? 'compact'
      : layoutDensity === 'expanded'
        ? 'expanded'
        : 'normal';

  const heroMcBlock =
    heroMc && (showVol || showMc) && !ultraChrome ? (
      <PulseRowVolMc
        vol={vol}
        mcUsd={mcUsd}
        showVol={showVol}
        showMc={showMc}
        size={slotHeight != null ? 'normal' : volMcSize}
        justify="end"
        layout="stack"
      />
    ) : null;

  /** Reserve horizontal space so token info never sits under the fixed right-side action column (Ultra / quick-buy). */
  const reserveRightActionCol =
    ultraChrome && (hasPrimaryBuy || showSecondBuy || showSecondSell);

  return (
    <div
      role={trackedDev ? 'group' : undefined}
      aria-label={
        trackedDev
          ? `Token row, tracked dev${trackedDevLabel ? `: ${trackedDevLabel}` : ''}`
          : undefined
      }
      className={cn(
        // `pulse-row` is the preference hook (bg / min-height / pad-y / hairline)
        // driven by data-* on <html>. Existing `bg-bg-raised` / border / py-*
        // /min-h on the outer have been removed so the CSS rule wins; `rounded-lg`
        // is kept so the focus ring + hover bg still hug the corner radius.
        'pulse-row group relative flex items-stretch rounded-lg border-0 outline-none transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-0',
        slotHeight != null
          ? 'h-full min-h-0 max-h-full overflow-hidden'
          : null,
        // !important so the elevation CSS rule (same specificity) can't out-win the tracked-dev tint.
        trackedDev && '!bg-accent-primary/[0.08]',
        pulseFlashHighlight && 'row-active z-[25]',
        // Column panel is bg-raised; rows pop on hover via a translucent
        // white overlay so the highlight reads across every theme.
        'hover:bg-white/[0.04]',
      )}
      style={slotHeight != null ? { height: slotHeight } : undefined}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-px transition',
          trackedDev ? 'bg-accent-primary opacity-100' : 'opacity-0',
        )}
      />

      <>
        {/*
          Social strip uses real <a href> links and nested Next <Link>s — invalid HTML and
          breaks clicks if the whole row is one Link. Hover targets the row; token navigation
          is only on avatar + title lines.
        */}
        <div
          role="link"
          tabIndex={0}
          aria-label={`Open ${ticker} token`}
          onClick={onTokenAreaClick}
          onKeyDown={onTokenAreaKeyDown}
          className={cn(
            'relative z-0 flex min-h-0 min-w-0 flex-1 cursor-pointer items-center p-3 outline-none focus-visible:bg-bg-hover/80',
            /**
             * Reservation MUST match the Ultra dock width formula below or token info
             * bleeds under the action column when the Pulse column is narrow.
             * `clamp()` lets the dock shrink with the column instead of pinning at min-w.
             */
            reserveRightActionCol &&
              'pr-[calc(clamp(7.5rem,32%,14rem)+0.5rem)]',
          )}
          {...hoverProps}
        >
          <div className="flex h-full min-h-0 w-full min-w-0 items-center gap-3">
            <Link
              href={tokenPath}
              className="shrink-0 outline-none focus-visible:bg-bg-hover rounded-lg"
            >
              {avatarStack}
            </Link>
            <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col justify-center space-y-2 overflow-hidden">
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                <Link
                  href={tokenPath}
                  className="block min-w-0 flex-1 overflow-hidden outline-none focus-visible:bg-bg-hover rounded-sm"
                >
                  <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                    {identityCluster}
                    {heroMcBlock}
                  </div>
                </Link>
                {!ultraChrome && !heroMc && (showVol || showMc) ? (
                  <div className="pointer-events-none shrink-0 tabular-nums">
                    <PulseRowVolMc
                      vol={vol}
                      mcUsd={mcUsd}
                      showVol={showVol}
                      showMc={showMc}
                      size={volMcSize}
                      justify="end"
                      layout="inline"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                {/* Age moves to the LEFT of the icon strip so it reads as
                    a leading timestamp (Axiom-style) instead of trailing
                    the symbol/name on the line above. */}
                {ageBadge}
                <PulseRowSocialStrip
                  bundle={bundle}
                  traits={{
                    cashback: showTraitIcons && traits.cashback,
                    feeShare: showTraitIcons && traits.feeShare,
                    agent: showTraitIcons && traits.agent,
                  }}
                  compact
                  glyphSize={20}
                  showLiquidity={showLiq}
                  showTxCount={showHolders}
                  showDevWallet={showDev}
                />
              </div>
            </div>
          </div>
        </div>

        {(canQuickBuy && quickBuySol != null) ||
        showRisk ||
        showSecondBuy ||
        showSecondSell ? (
          ultraChrome && (hasPrimaryBuy || showSecondBuy || showSecondSell) ? (
            <div
              className={cn(
                // `pulse-row-action` provides the optional vertical divider via
                // the global preferences CSS. `pl-3` keeps action content off
                // the new border-left when the divider preference is on.
                'pulse-row-action pointer-events-none absolute inset-y-0 right-0 z-20 flex items-stretch justify-end pl-3',
                slotHeight != null ? 'pr-0' : 'pr-2',
                slotHeight == null && 'min-h-[3.5rem]',
              )}
            >
              {/* Right-side action column sits flat against the row — no container fill, no border. */}
              <div
                className={cn(
                  /**
                   * Ultra dock width — single source of truth shared with the backdrop slab
                   * (above) and the click-target `pr-[calc(...)]` reservation. `clamp()` collapses
                   * gracefully when the Pulse column is narrow so the dock never forces
                   * column overflow at 100% Chrome zoom.
                   */
                  'pointer-events-auto relative z-[21] flex h-full min-h-0 w-[clamp(7.5rem,32%,14rem)] min-w-0 shrink-0 flex-col gap-0.5',
                )}
              >
                {(showVol || showMc) && !splitPairStrip ? (
                  <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[22] flex -translate-y-1/2 justify-end px-0.5">
                    <PulseRowVolMc
                      vol={vol}
                      mcUsd={mcUsd}
                      showVol={showVol}
                      showMc={showMc}
                      size="prominent"
                      justify="end"
                      layout={volMcLayout}
                    />
                  </div>
                ) : null}
                <div className="relative z-[21] flex min-h-0 flex-1 items-stretch gap-1.5">
                {splitPairStrip ? (
                  <>
                    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
                      {showVol ? (
                        <div className="pointer-events-none absolute inset-x-0 top-[28%] z-[22] flex -translate-y-1/2 justify-center px-0.5">
                          <PulseRowVolMc
                            vol={vol}
                            mcUsd={mcUsd}
                            showVol
                            showMc={false}
                            size="prominent"
                            justify="end"
                            layout="inline"
                          />
                        </div>
                      ) : null}
                      <div className="relative z-[21] flex min-h-0 flex-1 items-stretch justify-end">
                      {showSecondSell ? (
                        <UltraSellZone
                          pct={secondSellPct}
                          onSell={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            setActiveUltraAction('secondSell');
                            onPulseQuickSell?.();
                          }}
                          loading={pulseBuyBusy && activeUltraAction === 'secondSell'}
                          disabled={pulseBuyDisabled}
                        />
                      ) : showSecondBuy && secondBuySol > 0 ? (
                        <UltraQuickBuyZone
                          quickBuySol={secondBuySol}
                          quoteSymbol={quoteSymbol}
                          onBuy={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            setActiveUltraAction('secondBuy');
                            onPulseSecondBuy?.();
                          }}
                          loading={pulseBuyBusy && activeUltraAction === 'secondBuy'}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                      </div>
                    </div>
                    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
                      {showMc ? (
                        <div className="pointer-events-none absolute inset-x-0 top-[28%] z-[22] flex -translate-y-1/2 justify-center px-0.5">
                          <PulseRowVolMc
                            vol={vol}
                            mcUsd={mcUsd}
                            showVol={false}
                            showMc
                            size="prominent"
                            justify="end"
                            layout="inline"
                          />
                        </div>
                      ) : null}
                      <div className="relative z-[21] flex min-h-0 flex-1 items-stretch justify-end">
                      {hasPrimaryBuy ? (
                        <UltraQuickBuyZone
                          quickBuySol={quickBuySol}
                          quoteSymbol={quoteSymbol}
                          onBuy={onQuickBuy}
                          loading={pulseBuyBusy && activeUltraAction === 'primaryBuy'}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-end gap-1.5">
                    {showSecondSell ? (
                      <UltraSellZone
                        pct={secondSellPct}
                        onSell={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (pulseBuyDisabled || pulseBuyBusy) return;
                          setActiveUltraAction('secondSell');
                          onPulseQuickSell?.();
                        }}
                        loading={pulseBuyBusy && activeUltraAction === 'secondSell'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                    {showSecondBuy && secondBuySol > 0 ? (
                      <UltraQuickBuyZone
                        quickBuySol={secondBuySol}
                        quoteSymbol={quoteSymbol}
                        onBuy={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (pulseBuyDisabled || pulseBuyBusy) return;
                          setActiveUltraAction('secondBuy');
                          onPulseSecondBuy?.();
                        }}
                        loading={pulseBuyBusy && activeUltraAction === 'secondBuy'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                    {hasPrimaryBuy ? (
                      <UltraQuickBuyZone
                        quickBuySol={quickBuySol}
                        quoteSymbol={quoteSymbol}
                        onBuy={onQuickBuy}
                        loading={pulseBuyBusy && activeUltraAction === 'primaryBuy'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                  </div>
                )}
              </div>
              {showRisk ? (
                <div className="pointer-events-auto flex shrink-0 justify-end">
                  <RiskFlags token={token} snapshot={snapshot} className="shrink-0" />
                </div>
              ) : null}
              </div>
            </div>
          ) : !ultraChrome ? (
            <div
              className={cn(
                // Mirrors the Ultra branch — same preference hook so the divider
                // pref applies to both chrome modes.
                'pulse-row-action pointer-events-none absolute inset-y-0 right-0 z-20 flex items-end gap-1.5 pb-2.5 pl-3 pr-2',
                effectivePy,
              )}
            >
              <div className="pointer-events-auto flex min-w-0 flex-col items-stretch gap-1">
                <div
                  className={cn(
                    splitPairStrip
                      ? 'grid min-w-0 w-full grid-cols-2 gap-1'
                      : 'flex w-full min-w-0 flex-wrap items-center justify-end gap-1',
                  )}
                >
                  {splitPairStrip ? (
                    <>
                      <div className="min-w-0">
                        {showSecondSell ? (
                          <SellPctPill
                            pct={secondSellPct}
                            onSell={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pulseBuyDisabled || pulseBuyBusy) return;
                              onPulseQuickSell?.();
                            }}
                            loading={pulseBuyBusy}
                            disabled={pulseBuyDisabled}
                            pulseFit={slotHeight != null}
                            className="w-full min-w-0 max-w-none"
                          />
                        ) : showSecondBuy && secondBuySol > 0 ? (
                          <QuickBuyPill
                            quickBuySol={secondBuySol}
                            style={filledBuyStyle}
                            onBuy={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pulseBuyDisabled || pulseBuyBusy) return;
                              onPulseSecondBuy?.();
                            }}
                            loading={pulseBuyBusy}
                            disabled={pulseBuyDisabled}
                            pulseFit={slotHeight != null}
                            quoteSymbol={quoteSymbol}
                            className="w-full min-w-0 max-w-none"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        {hasPrimaryBuy ? (
                          <QuickBuyPill
                            quickBuySol={quickBuySol}
                            style={filledBuyStyle}
                            onBuy={onQuickBuy}
                            loading={pulseBuyBusy}
                            disabled={pulseBuyDisabled}
                            pulseFit={slotHeight != null}
                            quoteSymbol={quoteSymbol}
                            className="w-full min-w-0 max-w-none"
                          />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      {showSecondSell ? (
                        <SellPctPill
                          pct={secondSellPct}
                          onSell={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            onPulseQuickSell?.();
                          }}
                          loading={pulseBuyBusy}
                          disabled={pulseBuyDisabled}
                          pulseFit={slotHeight != null}
                        />
                      ) : null}
                      {showSecondBuy && secondBuySol > 0 ? (
                        <QuickBuyPill
                          quickBuySol={secondBuySol}
                          style={filledBuyStyle}
                          onBuy={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            onPulseSecondBuy?.();
                          }}
                          loading={pulseBuyBusy}
                          disabled={pulseBuyDisabled}
                          pulseFit={slotHeight != null}
                          quoteSymbol={quoteSymbol}
                        />
                      ) : null}
                      {hasPrimaryBuy ? (
                        <QuickBuyPill
                          quickBuySol={quickBuySol}
                          style={filledBuyStyle}
                          onBuy={onQuickBuy}
                          loading={pulseBuyBusy}
                          disabled={pulseBuyDisabled}
                          pulseFit={slotHeight != null}
                          quoteSymbol={quoteSymbol}
                        />
                      ) : null}
                    </>
                  )}
                </div>
                {showRisk ? (
                  <div className="flex justify-end">
                    <RiskFlags token={token} snapshot={snapshot} className="shrink-0" />
                  </div>
                ) : null}
              </div>
            </div>
          ) : showRisk ? (
            <div
              className={cn(
                'pointer-events-none absolute inset-y-0 right-0 z-20 flex items-end pb-2.5 pr-2',
                effectivePy,
              )}
            >
              <div className="pointer-events-auto">
                <RiskFlags token={token} snapshot={snapshot} className="shrink-0" />
              </div>
            </div>
          ) : null
        ) : null}
      </>
    </div>
  );
}

function QuickBuyPill({
  quickBuySol,
  style: _style,
  onBuy,
  loading,
  disabled,
  pulseFit: _pulseFit,
  quoteSymbol = 'TON',
  className,
}: {
  quickBuySol: number;
  style: Exclude<BuyButtonStyle, 'ultra'>;
  onBuy: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Pulse grid: fixed row height — button must never force the row taller. */
  pulseFit?: boolean;
  quoteSymbol?: string;
  className?: string;
}) {
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);

  /**
   * Axiom/Trojan-style subtle tinted pill. `style` / `pulseFit` still accepted (signature stable)
   * but no longer drive chrome variants — visual treatment is uniform per the polish spec.
   */
  const btn = cn(
    'btn-press focus-ring inline-flex h-5 min-w-0 max-w-full items-center justify-center gap-1 rounded border-0 bg-signal-bull/10 px-2 font-sans text-xs font-medium leading-none text-signal-bull transition-colors hover:bg-signal-bull/15 active:bg-signal-bull/20',
    (disabled || loading) && 'pointer-events-none opacity-55',
    className,
  );

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled || loading}
      className={btn}
      title={`Quick trade: ${labelAmount} ${quoteSymbol} on this mint`}
      aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Zap className="h-3 w-3 inline shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate">{`${labelAmount} ${quoteSymbol}`}</span>
    </button>
  );
}

function SellPctPill({
  pct,
  onSell,
  loading,
  disabled,
  pulseFit,
  className,
}: {
  pct: number;
  onSell: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  pulseFit?: boolean;
  className?: string;
}) {
  const sizeCls = pulseFit
    ? 'h-8 max-h-8 min-h-[28px] gap-1 px-2 text-[10px] leading-none'
    : 'min-h-9 gap-1.5 px-3 text-[11px] leading-none';

  return (
    <button
      type="button"
      onClick={onSell}
      disabled={disabled || loading}
      className={cn(
        'btn-press focus-ring pointer-events-auto inline-flex min-w-0 max-w-full items-center justify-center rounded-md border border-red-400/45 bg-bg-base/95 font-sans font-semibold tabular-nums tracking-normal text-red-300/95 transition hover:border-red-400/70 hover:bg-red-500/10',
        sizeCls,
        (disabled || loading) && 'pointer-events-none opacity-55',
        className,
      )}
      title={`Sell ${pct}% of your balance for this token`}
      aria-label={`Sell ${pct} percent`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
      ) : (
        <span>{`Sell ${pct}%`}</span>
      )}
    </button>
  );
}

/** Ultra quick-buy zone: amount anchored bottom-right inside outline (Axiom-style execution chip). */
function UltraQuickBuyZone({
  quickBuySol,
  quoteSymbol,
  onBuy,
  loading,
  disabled,
}: {
  quickBuySol: number;
  quoteSymbol: string;
  onBuy: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled || loading}
      className={cn(
        /** Square outline (1:1) — height drives size, max-w-full keeps it from overflowing narrow columns. */
        'focus-ring relative z-[21] flex aspect-square h-full min-h-0 max-h-full max-w-full flex-col items-end justify-end rounded-[5px] border border-emerald-400/90 bg-transparent p-2 pb-2.5 pr-2.5 font-sans font-semibold tabular-nums tracking-normal text-emerald-400 transition-all duration-200',
        'shadow-[0_0_14px_-14px_rgba(52,211,153,0.38)] backdrop-blur-none',
        'hover:border-emerald-300/95 hover:bg-emerald-400/[0.08] hover:shadow-[0_0_18px_-12px_rgba(52,211,153,0.48)] hover:backdrop-blur-[6px]',
        'active:border-emerald-300 active:bg-emerald-400/12 active:backdrop-blur-sm',
        'disabled:pointer-events-none disabled:opacity-55',
      )}
      title={`Quick trade: ${labelAmount} ${quoteSymbol} on this mint`}
      aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2
          className="absolute left-1/2 top-1/2 h-4 w-4 shrink-0 -translate-x-1/2 -translate-y-1/2 animate-spin text-emerald-400"
          aria-hidden
        />
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[10px] leading-none sm:text-[11px]">
          <Zap
            className="h-3 w-3 shrink-0 fill-emerald-400/35 text-emerald-400 sm:h-3.5 sm:w-3.5"
            aria-hidden
          />
          <span className="min-w-0 text-right">{`${labelAmount} ${quoteSymbol}`}</span>
        </span>
      )}
    </button>
  );
}

/** Ultra sell: full-zone outline button (second slot). */
function UltraSellZone({
  pct,
  onSell,
  loading,
  disabled,
}: {
  pct: number;
  onSell: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSell}
      disabled={disabled || loading}
      className={cn(
        /** Square outline (1:1) — same sizing rule as UltraQuickBuyZone. */
        'focus-ring relative z-[21] flex aspect-square h-full min-h-0 max-h-full max-w-full flex-col items-end justify-end rounded-[5px] border border-rose-400/85 bg-transparent p-2 pb-2.5 pr-2.5 font-semibold tabular-nums text-rose-300 transition-all duration-200',
        'shadow-[0_0_12px_-14px_rgba(251,113,133,0.32)] backdrop-blur-none',
        'hover:border-rose-300/95 hover:bg-rose-500/[0.1] hover:shadow-[0_0_16px_-12px_rgba(251,113,133,0.42)] hover:backdrop-blur-[6px]',
        'active:bg-rose-500/14 active:backdrop-blur-sm',
        'disabled:pointer-events-none disabled:opacity-55',
      )}
      title={`Sell ${pct}% of your balance for this token`}
      aria-label={`Sell ${pct} percent`}
    >
      {loading ? (
        <Loader2
          className="absolute left-1/2 top-1/2 h-3.5 w-3.5 shrink-0 -translate-x-1/2 -translate-y-1/2 animate-spin text-rose-300"
          aria-hidden
        />
      ) : (
        <span className="shrink-0 text-right text-[10px] leading-none sm:text-[11px]">{`Sell ${pct}%`}</span>
      )}
    </button>
  );
}

function formatSolDraft(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) return '';
  const t = sol.toFixed(8).replace(/\.?0+$/, '');
  return t || String(sol);
}
