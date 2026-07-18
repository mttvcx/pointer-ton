'use client';

import { useRouter } from 'next/navigation';
import {
  memo,
  startTransition,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Eye, Loader2, Zap } from 'lucide-react';
import { PulseRowSocialStrip } from '@/components/tokens/PulseRowSocialStrip';
import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import { PulseRowMiniChart } from '@/components/tokens/PulseRowMiniChart';
import { getMiniChartSeries, pushMiniChartPrice } from '@/store/pulseMiniChartSeries';
import { PulseRowAxiomSpriteStrip } from '@/components/tokens/PulseRowAxiomSpriteStrip';
import { PulseRowBondingHoverTag } from '@/components/tokens/PulseRowBondingHoverTag';
import { PulseMayhemTimerBadge } from '@/components/tokens/PulseMayhemTimerBadge';
import { PulseRowAgeLabel } from '@/components/tokens/PulseRowAgeLabel';
import { PulseTokenAvatarHover } from '@/components/tokens/PulseTokenAvatarHover';
import { PulseTokenTitleRow } from '@/components/tokens/PulseTokenTitleRow';
import { usePreferences } from '@/components/preferences/PreferencesProvider';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { QuotePairBadge } from '@/components/tokens/QuotePairBadge';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { syntheticPulseVolMc } from '@/lib/dev/demoTokenFixtures';
import type { QuickBuyUltraChrome } from '@/lib/preferences/pulseDisplay';
import type { BuyButtonStyle, ColumnDisplayOptions } from '@/lib/tokens/columnPresetModel';
import { getPulseRowTraitFlags } from '@/lib/tokens/pumpTokenSignals';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import {
  resolveLaunchpadAvatarChrome,
} from '@/lib/tokens/launchpadAvatarChrome';
import { launchPadToProtocolId } from '@/lib/tokens/protocolBrand';
import { alternateQuotePairKind } from '@/lib/tokens/quoteToken';
import { metricBandColorForValue } from '@/lib/pulse/metricBandColor';
import { resolveProtocolRowTint } from '@/lib/pulse/protocolRowTint';
import { resolvePulseTranslationGloss } from '@/lib/translate/pulseTranslationGloss';
import { useAutoTranslateStore } from '@/store/autoTranslate';
import { PulseMintCopyCaption } from '@/components/tokens/PulseMintCopyCaption';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseRowDensity } from '@/store/pulseColumns';
import type { PulseTokenBundle } from '@/types/tokens';

type UltraActionKey = 'primaryBuy' | 'secondBuy' | 'secondSell';

/** Blur V/MC behind the quick-buy dock on hover (metrics sit above the button in z-order). */
const PULSE_DOCK_METRIC_HOVER_BLUR =
  'transition-[filter,opacity] duration-200 ease-out group-hover/pulseDock:blur-[5px] group-hover/pulseDock:opacity-45';

function TokenRowInner({
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
  /** Fixed pixel height from Pulse virtualizer — keeps every row the same size. */
  slotHeight,
  /** Native quote for quick-buy chip (TON / SOL / …). */
  quoteSymbol = 'TON',
  avatarImagePriority = false,
  miniChart = null,
}: {
  bundle: PulseTokenBundle;
  density?: PulseRowDensity;
  display?: ColumnDisplayOptions;
  quickBuySol?: number;
  buyButtonStyle?: BuyButtonStyle;
  /** Execute swap for this row's mint using column header amount (labelled by `quoteSymbol`). */
  onPulseQuickBuy?: (mint: string) => void;
  /** Second quick-buy (left of primary). Uses `display.secondQuickBuySol`. */
  onPulseSecondBuy?: (mint: string) => void;
  /** Percent sell when `display.pulseSecondButton === 'sell_pct'`. */
  onPulseQuickSell?: (mint: string) => void;
  pulseBuyBusy?: boolean;
  pulseBuyDisabled?: boolean;
  /** Pulse board column (bonding ring semantics / gold on migrated lane). */
  columnId?: PulseColumnId;
  slotHeight?: number;
  quoteSymbol?: string;
  avatarImagePriority?: boolean;
  /** Resolved Axiom-style mini-chart background for this column (null = off). */
  miniChart?: { size: number; opacity: number; edgeFade: number } | null;
}) {
  const router = useRouter();
  const { token, snapshot } = bundle;

  // Accumulate this row's real observed price into the rolling buffer that feeds
  // the Mini Chart background. Always record (even when the chart is off) so
  // toggling it on shows history immediately. Decorative only — never affects data.
  const priceUsd = snapshot?.price_usd ?? null;
  useEffect(() => {
    pushMiniChartPrice(token.mint, priceUsd);
  }, [token.mint, priceUsd]);
  // Copy so the chart's memo sees a new reference each tick (the buffer mutates
  // in place). Cheap — at most 48 numbers.
  const miniSeries = miniChart ? getMiniChartSeries(token.mint).slice() : null;

  const trackPulseFlashMint = useUIStore((s) => s.trackPulseHighlightMint);
  const activeChain = useUIStore((s) => s.activeChain);
  const pulseFlashHighlight =
    Boolean(trackPulseFlashMint) && token.mint === trackPulseFlashMint;

  const uiDemo = useUiDemoMode();
  const demoMetrics = useMemo(
    () => (uiDemo ? syntheticPulseVolMc(token.mint) : null),
    [uiDemo, token.mint],
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

  /**
   * Latin gloss line under non-Latin Pulse identities — applies to **every chain**
   * now (Hebrew, Arabic, CJK, Cyrillic, Devanagari, Thai, Hangul, …), not just BNB.
   */
  const autoTranslate = useAutoTranslateStore();
  const translationGloss = useMemo(
    () => resolvePulseTranslationGloss(token, autoTranslate),
    [
      token,
      autoTranslate.enabled,
      autoTranslate.translateAllLanguages,
      autoTranslate.selectedLanguageIds,
    ],
  );

  const translationGlossVisible =
    Boolean(translationGloss) &&
    autoTranslate.enabled &&
    (autoTranslate.showBoth || !autoTranslate.showOnHover);
  const translationGlossHoverOnly =
    Boolean(translationGloss) &&
    autoTranslate.enabled &&
    !autoTranslate.showBoth &&
    autoTranslate.showOnHover;
  const volRaw = snapshot?.volume_24h_usd ?? snapshot?.volume_1h_usd;
  const vol =
    volRaw != null && Number.isFinite(volRaw)
      ? volRaw
      : demoMetrics?.volUsd ?? null;
  const mcUsd =
    snapshot?.market_cap_usd != null && Number.isFinite(snapshot.market_cap_usd)
      ? snapshot.market_cap_usd
      : demoMetrics?.mcUsd ?? null;

  const showMc = display?.showMc ?? true;
  const showVol = display?.showVol ?? true;
  const showHolders = display?.showHolders ?? true;
  const showDev = display?.showDev ?? true;
  const showRing = display?.showBondingRing ?? true;
  const showBadge = display?.showLaunchpadBadge ?? true;
  const mcLayout = display?.mcLayout ?? 'strip';
  const showPumpFrame = display?.showPumpFrame ?? true;
  const showTraitIcons = display?.showTraitIcons ?? true;
  const showRowMc = usePulseDisplayPrefsStore((s) => s.rowFields.marketCap);
  const colorRowByProtocol = usePulseDisplayPrefsStore((s) => s.colorRowByProtocol);
  const metricBands = usePulseDisplayPrefsStore((s) => s.metricBands);
  const protocolRowColors = usePulseDisplayPrefsStore((s) => s.protocolRowColors);
  const protocolColorHex = usePulseDisplayPrefsStore((s) => s.protocolColorHex);
  const quickBuyUltraChrome = usePulseDisplayPrefsStore((s) => s.quickBuyUltraChrome);
  const heroMc = mcLayout === 'hero' && showMc && (slotHeight == null || showRowMc);
  const traits = useMemo(() => getPulseRowTraitFlags(bundle), [bundle]);
  const bond = useMemo(() => getPulseBondingRingState(bundle), [bundle]);
  const isMigratedVisual = columnId === 'migrated' || bond.migrated;
  const launchpadChrome = useMemo(() => {
    const opts = {
      showFrame: showPumpFrame,
      isMigrated: bond.migrated || columnId === 'migrated',
      pumpFunOnBondingCurve: traits.pumpFunBonding,
      chain: activeChain,
    };
    return resolveLaunchpadAvatarChrome(bundle, opts);
  }, [bundle, showPumpFrame, bond.migrated, columnId, traits.pumpFunBonding, activeChain]);

  /** Pulse virtualizer rows use a single locked footprint; ignore per-preset density there. */
  const layoutDensity: PulseRowDensity = slotHeight != null ? 'normal' : density ?? 'normal';

  // Avatar size preference (Small / Default / Large) scales the computed size.
  const { prefs } = usePreferences();
  const avatarScale =
    prefs.avatarSize === 'small' ? 0.84 : prefs.avatarSize === 'large' ? 1.18 : 1;

  /** Pulse grid: fill most of the slot height (Axiom-style). Else preference-driven rhythm. */
  const avatarSize = useMemo(() => {
    let base: number;
    if (slotHeight != null) {
      const verticalPad = 24; // pt-4 + pb-2 on Pulse grid hit area
      const captionReserve = 15; // truncated mint + gap under avatar
      const raw = slotHeight - verticalPad - captionReserve;
      base = Math.min(78, Math.max(44, Math.round(raw)));
    } else if (layoutDensity === 'compact') {
      base = 48;
    } else if (layoutDensity === 'expanded') {
      base = 56;
    } else {
      base = 52;
    }
    return Math.round(Math.min(88, Math.max(38, base * avatarScale)));
  }, [slotHeight, layoutDensity, avatarScale]);

  /**
   * Strip icon size — bumped ~10% across the board so Pulse rows read closer to Axiom:
   *  - tall slot 112+: 26 → 29
   *  - mid  slot 96+ : 24 → 26
   *  - short slot     : 22 → 24
   *  - non-pulse densities: 22→24 / 24→26 / 28→31.
   */
  const socialGlyphSize = useMemo(() => {
    if (slotHeight != null) {
      if (slotHeight >= 112) return 27;
      if (slotHeight >= 96) return 24;
      return 22;
    }
    if (layoutDensity === 'expanded') return 28;
    if (layoutDensity === 'compact') return 22;
    return 24;
  }, [slotHeight, layoutDensity]);

  const rowMinH =
    layoutDensity === 'compact'
      ? 'min-h-[68px]'
      : layoutDensity === 'expanded'
        ? 'min-h-[92px]'
        : 'min-h-[76px]';
  const py =
    layoutDensity === 'compact' ? 'py-2' : layoutDensity === 'expanded' ? 'py-3' : 'py-2.5';
  const effectivePy = slotHeight != null ? 'py-1.5' : py;

  const devWallet = token.creator_wallet;
  const trackedDev =
    !!devWallet && showDev && isTracked(devWallet);
  const trackedDevLabel = trackedDev ? labelFor(devWallet) : null;
  /**
   * Ultra dock = outline tiles + V/MC in the right column (Axiom Ultra preset only).
   * Pulse virtual rows with small/medium/large use filled pills at the bottom —
   * do not treat every Pulse row as Ultra or the full-height dock blocks token clicks.
   */
  const ultraChrome = buyButtonStyle === 'ultra';
  const pulseRow = slotHeight != null;
  /** Pulse + Ultra: compact square tiles must not stretch to full row height. */
  const pulseUltraCompact = pulseRow && ultraChrome;
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

  /** Truncated mint under avatar — Axiom-style hover + custom copy chip (no browser title). */
  const mintCaption = (
    <PulseMintCopyCaption mint={token.mint} compact={slotHeight == null} />
  );

  const avatarStack = (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center overflow-visible',
        slotHeight != null ? 'gap-1.5' : 'gap-px',
      )}
      style={{ minWidth: avatarSize }}
    >
      <PulseTokenAvatarHover
        bundle={bundle}
        size={avatarSize}
        showRing={showRing}
        launchpadChrome={launchpadChrome}
        columnId={columnId}
        avatarImagePriority={avatarImagePriority}
        className="relative z-[4]"
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
    if (pulseBuyDisabled) return;
    if (quickBuySol == null || !Number.isFinite(quickBuySol) || quickBuySol <= 0) return;
    setActiveUltraAction('primaryBuy');
    onPulseQuickBuy?.(token.mint);
  }

  const tokenPath = `/token/${token.mint}`;
  const isInteractiveClickTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'a,button,input,select,textarea,[role="button"],[data-row-click-skip="true"]',
      ),
    );

  const openToken = () => {
    startTransition(() => {
      router.push(tokenPath);
    });
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

  /** Primary title + optional BNB English gloss (metadata-driven, Axiom-style). */
  const nameCluster = (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-nowrap items-center gap-2',
        slotHeight == null && 'overflow-hidden',
      )}
    >
      {slotHeight != null ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <PulseTokenTitleRow mint={token.mint} ticker={ticker} name={name} size="pulse" />
          {translationGloss ? (
            <p
              className={cn(
                'min-w-0 max-w-full truncate font-sans text-[12px] font-normal leading-snug tracking-tight transition-opacity duration-150',
                translationGlossHoverOnly &&
                  'max-h-0 overflow-hidden opacity-0 group-hover/pulseRow:max-h-8 group-hover/pulseRow:opacity-100',
                !translationGlossVisible && translationGlossHoverOnly && 'pointer-events-none',
              )}
              style={{ color: autoTranslate.textColor }}
              title={translationGloss}
            >
              {translationGloss}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          <PulseTokenTitleRow mint={token.mint} ticker={ticker} name={name} size="compact" />
          {translationGloss ? (
            <p
              className={cn(
                'min-w-0 truncate font-sans text-[12px] font-normal leading-snug tracking-tight transition-opacity duration-150',
                translationGlossHoverOnly &&
                  'max-h-0 overflow-hidden opacity-0 group-hover/pulseRow:max-h-8 group-hover/pulseRow:opacity-100',
                !translationGlossVisible && translationGlossHoverOnly && 'pointer-events-none',
              )}
              style={{ color: autoTranslate.textColor }}
              title={translationGloss}
            >
              {translationGloss}
            </p>
          ) : null}
        </div>
      )}
      {slotHeight == null && showBadge ? (
        <span className="inline-flex max-w-[min(11rem,42%)] shrink-0 flex-nowrap items-center gap-1 overflow-hidden">
          {launchpadChrome || token.launch_pad === 'pump.fun' ? null : (
            <LaunchpadBadge launchPad={token.launch_pad} />
          )}
          <LaunchpadSubBadges
            bundle={bundle}
            variant={layoutDensity === 'expanded' ? 'detail' : 'inline'}
          />
        </span>
      ) : null}
      {slotHeight == null && trackedDev ? (
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
  const alternateQuote = useMemo(
    () => alternateQuotePairKind(bundle, activeChain),
    [bundle, activeChain],
  );
  const quoteIconPx = Math.max(13, Math.round(socialGlyphSize * 0.54));
  const ageBadge = (
    <PulseRowAgeLabel createdAt={token.created_at} compact={slotHeight != null} rowAlign />
  );
  const ageQuotePairBadge =
    alternateQuote != null ? (
      <QuotePairBadge
        kind={alternateQuote}
        chain={activeChain}
        variant="icon"
        iconPx={quoteIconPx}
      />
    ) : null;
  const ageCluster = (
    <div className="inline-flex h-6 shrink-0 items-center gap-1">
      {ageBadge}
      {ageQuotePairBadge}
    </div>
  );
  const mayhemBadge = (
    <PulseMayhemTimerBadge
      bundle={bundle}
      className={slotHeight != null ? 'text-[13px]' : 'text-xs'}
    />
  );

  const volMcSize =
    layoutDensity === 'compact'
      ? 'compact'
      : layoutDensity === 'expanded'
        ? 'expanded'
        : 'normal';
  /** Axiom rule: MC value is cyan pre-migration, gold once migrated. */
  const mcTone: 'cyan' | 'gold' = isMigratedVisual ? 'gold' : 'cyan';

  const protocolTint = useMemo(() => {
    if (trackedDev) return null;
    return resolveProtocolRowTint(
      { colorRowByProtocol, protocolRowColors, protocolColorHex },
      launchPadToProtocolId(token.launch_pad, activeChain),
    );
  }, [
    trackedDev,
    colorRowByProtocol,
    protocolRowColors,
    protocolColorHex,
    token.launch_pad,
    activeChain,
  ]);

  const volMcBandProps = useMemo(() => {
    if (!colorRowByProtocol) return { mcTone };
    return {
      volColor: metricBandColorForValue(vol, metricBands.volume),
      mcColor: metricBandColorForValue(mcUsd, metricBands.marketCap),
    };
  }, [colorRowByProtocol, vol, mcUsd, metricBands, mcTone]);
  /** Ultra dock: outline when `ultra`, solid fill for small/medium/large on Pulse + elsewhere. */
  const filledDockButton = buyButtonStyle !== 'ultra';
  /** Display panel can force solid ultra tiles (`filled`) or strip borders (`borderless`). */
  const ultraFilledFromChrome = ultraChrome && quickBuyUltraChrome === 'filled';
  const ultraDockFilled = filledDockButton || ultraFilledFromChrome;

  const hasRightActions = hasPrimaryBuy || showSecondBuy || showSecondSell;
  /** Pulse + Ultra: right dock with V/MC header + buy tiles (outline or filled). */
  const useActionDock = hasRightActions && (pulseRow || ultraChrome);
  const reserveRightActionCol = useActionDock;
  const dockWidthClass = pulseDockWidthClass(ultraChrome, pulseUltraCompact, filledBuyStyle);
  const dockReservePadding = pulseDockReservePadding(ultraChrome, pulseUltraCompact, filledBuyStyle);

  const heroMcBlock =
    heroMc && (showVol || showMc) && !useActionDock ? (
      <PulseRowVolMc
        vol={vol}
        mcUsd={mcUsd}
        showVol={showVol}
        showMc={showMc}
        size={slotHeight != null ? 'normal' : volMcSize}
        justify="end"
        layout="stack"
        {...volMcBandProps}
      />
    ) : null;

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
        //
        // Card surface + border come from `.pulse-column .pulse-row` in globals.css
        // (theme tokens). Tracked-dev tints below still override via `!bg-…`.
        'pulse-row group/pulseRow group relative flex items-stretch rounded-lg outline-none transition-colors duration-150 ease-out',
        slotHeight != null
          ? 'h-full min-h-0 max-h-full overflow-visible'
          : null,
        // !important so the elevation CSS rule (same specificity) can't out-win the tracked-dev tint.
        trackedDev && '!bg-accent-primary/[0.08]',
        pulseFlashHighlight && 'row-active z-[25]',
        protocolTint && 'pulse-row-protocol-tint',
      )}
      data-protocol-tint={protocolTint ? '' : undefined}
      style={{
        ...(slotHeight != null ? { height: slotHeight } : {}),
        ...(protocolTint
          ? ({ '--pulse-protocol-tint': protocolTint.color } as CSSProperties)
          : {}),
      }}
    >
      {miniChart && miniSeries ? (
        <PulseRowMiniChart
          series={miniSeries}
          size={miniChart.size}
          opacity={miniChart.opacity}
          edgeFade={miniChart.edgeFade}
        />
      ) : null}

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
            'relative z-[1] flex min-h-0 min-w-0 flex-1 cursor-pointer items-start outline-none transition-[background-color] duration-150',
            'hover:bg-white/[0.04]',
            'focus-visible:bg-bg-hover/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/45',
            slotHeight != null ? 'pl-5 pr-3 pt-4 pb-2' : 'p-3',
          )}
          {...hoverProps}
        >
          <div className="flex h-full min-h-0 w-full min-w-0 items-start gap-2.5 sm:gap-3">
            <div className="shrink-0 self-start">{avatarStack}</div>
            <div
              className={cn(
                /** Pulse board: overflow visible so social-strip / compact hovers aren't clipped vertically. */
                'relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col justify-start',
                slotHeight != null ? 'overflow-visible gap-2' : 'overflow-hidden space-y-2',
              )}
            >
              <div
                className={cn(
                  // Only the name row reserves the dock column — icon/chip rows stay full-width.
                  'flex min-w-0 flex-nowrap items-center gap-2',
                  slotHeight == null && 'overflow-hidden',
                  reserveRightActionCol && dockReservePadding,
                )}
              >
                <div className="block min-w-0 flex-1">
                  <div className="flex min-w-0 flex-nowrap items-center gap-2">
                    {identityCluster}
                    {heroMcBlock}
                  </div>
                </div>
                {!useActionDock && !heroMc && (showVol || showMc) ? (
                  <div className="pointer-events-none shrink-0 tabular-nums">
                    <PulseRowVolMc
                      vol={vol}
                      mcUsd={mcUsd}
                      showVol={showVol}
                      showMc={showMc}
                      size={volMcSize}
                      justify="end"
                      layout="inline"
                      {...volMcBandProps}
                    />
                  </div>
                ) : null}
              </div>
              {slotHeight != null ? (
                /**
                 * Pulse virtual row body. `flex-1` fills the remaining row height
                 * below the name line; `mt-auto` on the chips wrapper anchors the
                 * metric pills to the bottom of that column, so the strip stays
                 * at the same vertical position whether or not the Twitter
                 * handle / follower row is rendered (Axiom-style consistency).
                 */
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-visible">
                  <div className="flex min-h-0 min-w-0 flex-nowrap items-center gap-1 overflow-visible">
                    {ageCluster}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
                      <PulseRowSocialStrip
                        bundle={bundle}
                        traits={{
                          cashback: showTraitIcons && traits.cashback,
                          feeShare: showTraitIcons && traits.feeShare,
                          agent: showTraitIcons && traits.agent,
                        }}
                        compact
                        pulseBoard
                        chain={activeChain}
                        glyphSize={socialGlyphSize}
                        showTxCount={showHolders}
                        showDevWallet={showDev}
                      />
                      {mayhemBadge ? (
                        <div className="min-w-0 shrink-0 pt-0.5">{mayhemBadge}</div>
                      ) : null}
                    </div>
                  </div>
                  {/**
                   * Metric chips align under the age column (2m / 8s), not under social icons.
                   */}
                  <div className="group/metricStrip relative min-w-0 overflow-visible pt-0.5">
                    <PulseRowBondingHoverTag
                      fillPct={bond.fillPct}
                      migrated={isMigratedVisual || bond.migrated}
                    />
                    <PulseRowAxiomSpriteStrip
                      bundle={bundle}
                      socialGlyphPx={socialGlyphSize}
                    />
                  </div>
                </div>
              ) : (
                <div className={cn('min-w-0 space-y-0.5', 'mt-0.5 pt-1')}>
                  <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                    {ageCluster}
                    <PulseRowSocialStrip
                      bundle={bundle}
                      traits={{
                        cashback: showTraitIcons && traits.cashback,
                        feeShare: showTraitIcons && traits.feeShare,
                        agent: showTraitIcons && traits.agent,
                      }}
                      compact
                      chain={activeChain}
                      glyphSize={socialGlyphSize}
                      showTxCount={showHolders}
                      showDevWallet={showDev}
                    />
                  </div>
                  {mayhemBadge ? <div className="min-w-0 pt-0.5">{mayhemBadge}</div> : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {(canQuickBuy && quickBuySol != null) ||
        showSecondBuy ||
        showSecondSell ? (
          useActionDock ? (
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
                  'group/pulseDock pointer-events-none relative z-[21] flex h-full min-h-0 min-w-0 shrink-0 flex-col gap-0.5',
                  dockWidthClass,
                )}
              >
                {(showVol || showMc) && !splitPairStrip ? (
                  <div
                    className={cn(
                      // Anchor V/MC to the top-right of the dock (Axiom-style header strip).
                      // `top-4` (~16px) gives the row-top breathing room Axiom uses; `pr-3`
                      // pulls the text in from the row's right edge instead of flush right.
                      'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-end pl-0.5 pr-3',
                      PULSE_DOCK_METRIC_HOVER_BLUR,
                    )}
                  >
                    <PulseRowVolMc
                      vol={vol}
                      mcUsd={mcUsd}
                      showVol={showVol}
                      showMc={showMc}
                      size="prominent"
                      justify="end"
                      layout={volMcLayout}
                      {...volMcBandProps}
                    />
                  </div>
                ) : null}
                <div
                  className={cn(
                    'relative z-[21] flex min-h-0 flex-1 gap-1.5 items-stretch pointer-events-none',
                  )}
                >
                {ultraChrome ? (
                  splitPairStrip ? (
                    <>
                      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
                        {showVol ? (
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-center px-0.5',
                              PULSE_DOCK_METRIC_HOVER_BLUR,
                            )}
                          >
                            <PulseRowVolMc
                              vol={vol}
                              mcUsd={mcUsd}
                              showVol
                              showMc={false}
                              size="prominent"
                              justify="end"
                              layout="inline"
                              {...volMcBandProps}
                            />
                          </div>
                        ) : null}
                        <div className="relative z-[21] flex min-h-0 flex-1 justify-end items-stretch">
                          {showSecondSell ? (
                            <UltraSellZone
                              pct={secondSellPct}
                              pulseGrid={pulseUltraCompact}
                              filled={filledDockButton}
                              onSell={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (pulseBuyDisabled) return;
                                setActiveUltraAction('secondSell');
                                onPulseQuickSell?.(token.mint);
                              }}
                              loading={false}
                              disabled={pulseBuyDisabled}
                            />
                          ) : showSecondBuy && secondBuySol > 0 ? (
                            <UltraQuickBuyZone
                              quickBuySol={secondBuySol}
                              quoteSymbol={quoteSymbol}
                              pulseGrid={pulseUltraCompact}
                              filled={ultraDockFilled}
                              ultraChromeStyle={quickBuyUltraChrome}
                              onBuy={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (pulseBuyDisabled) return;
                                setActiveUltraAction('secondBuy');
                                onPulseSecondBuy?.(token.mint);
                              }}
                              loading={false}
                              disabled={pulseBuyDisabled}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
                        {showMc ? (
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-center px-0.5',
                              PULSE_DOCK_METRIC_HOVER_BLUR,
                            )}
                          >
                            <PulseRowVolMc
                              vol={vol}
                              mcUsd={mcUsd}
                              showVol={false}
                              showMc
                              size="prominent"
                              justify="end"
                              layout="inline"
                              {...volMcBandProps}
                            />
                          </div>
                        ) : null}
                        <div className="relative z-[21] flex min-h-0 flex-1 justify-end items-stretch">
                          {hasPrimaryBuy ? (
                            <UltraQuickBuyZone
                              quickBuySol={quickBuySol}
                              quoteSymbol={quoteSymbol}
                              pulseGrid={pulseUltraCompact}
                              filled={ultraDockFilled}
                              ultraChromeStyle={quickBuyUltraChrome}
                              onBuy={onQuickBuy}
                              loading={false}
                              disabled={pulseBuyDisabled}
                            />
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 justify-end gap-1.5 items-stretch">
                      {showSecondSell ? (
                        <UltraSellZone
                          pct={secondSellPct}
                          pulseGrid={pulseUltraCompact}
                          filled={filledDockButton}
                          onSell={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled) return;
                            setActiveUltraAction('secondSell');
                            onPulseQuickSell?.(token.mint);
                          }}
                          loading={false}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                      {showSecondBuy && secondBuySol > 0 ? (
                        <UltraQuickBuyZone
                          quickBuySol={secondBuySol}
                          quoteSymbol={quoteSymbol}
                          pulseGrid={pulseUltraCompact}
                          filled={ultraDockFilled}
                          ultraChromeStyle={quickBuyUltraChrome}
                          onBuy={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled) return;
                            setActiveUltraAction('secondBuy');
                            onPulseSecondBuy?.(token.mint);
                          }}
                          loading={false}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                      {hasPrimaryBuy ? (
                        <UltraQuickBuyZone
                          quickBuySol={quickBuySol}
                          quoteSymbol={quoteSymbol}
                          pulseGrid={pulseUltraCompact}
                          filled={ultraDockFilled}
                          ultraChromeStyle={quickBuyUltraChrome}
                          onBuy={onQuickBuy}
                          loading={false}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                    </div>
                  )
                ) : (
                  <div
                    className={cn(
                      'min-h-0 w-full flex-1 pb-2 pr-2.5',
                      splitPairStrip
                        ? 'grid grid-cols-2 gap-1 px-0.5'
                        : 'flex flex-col justify-end',
                    )}
                  >
                    {splitPairStrip ? (
                      <>
                        <div className="relative flex min-h-0 min-w-0 flex-col">
                          {showVol ? (
                            <div
                              className={cn(
                                'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-center px-0.5',
                                PULSE_DOCK_METRIC_HOVER_BLUR,
                              )}
                            >
                              <PulseRowVolMc
                                vol={vol}
                                mcUsd={mcUsd}
                                showVol
                                showMc={false}
                                size="prominent"
                                justify="end"
                                layout="inline"
                                {...volMcBandProps}
                              />
                            </div>
                          ) : null}
                          <div className="mt-auto flex min-w-0 items-end justify-end">
                            {showSecondSell ? (
                              <SellPctPill
                                pct={secondSellPct}
                                onSell={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (pulseBuyDisabled) return;
                                  onPulseQuickSell?.(token.mint);
                                }}
                                loading={false}
                                disabled={pulseBuyDisabled}
                                pulseFit={pulseRow}
                                className="pointer-events-auto w-full min-w-0 max-w-none"
                              />
                            ) : showSecondBuy && secondBuySol > 0 ? (
                              <QuickBuyPill
                                quickBuySol={secondBuySol}
                                style={filledBuyStyle}
                                onBuy={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (pulseBuyDisabled) return;
                                  onPulseSecondBuy?.(token.mint);
                                }}
                                loading={false}
                                disabled={pulseBuyDisabled}
                                pulseFit={pulseRow}
                                quoteSymbol={quoteSymbol}
                                className="pointer-events-auto w-full min-w-0 max-w-none"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="relative flex min-h-0 min-w-0 flex-col">
                          {showMc ? (
                            <div
                              className={cn(
                                'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-center px-0.5',
                                PULSE_DOCK_METRIC_HOVER_BLUR,
                              )}
                            >
                              <PulseRowVolMc
                                vol={vol}
                                mcUsd={mcUsd}
                                showVol={false}
                                showMc
                                size="prominent"
                                justify="end"
                                layout="inline"
                                {...volMcBandProps}
                              />
                            </div>
                          ) : null}
                          <div className="mt-auto flex min-w-0 items-end justify-end">
                            {hasPrimaryBuy ? (
                              <QuickBuyPill
                                quickBuySol={quickBuySol}
                                style={filledBuyStyle}
                                onBuy={onQuickBuy}
                                loading={false}
                                disabled={pulseBuyDisabled}
                                pulseFit={pulseRow}
                                quoteSymbol={quoteSymbol}
                                className="pointer-events-auto w-full min-w-0 max-w-none"
                              />
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        className={cn(
                          'flex w-full items-end justify-end gap-1.5',
                          filledBuyStyle === 'large' && pulseRow && 'min-h-0 flex-1 flex-col',
                        )}
                      >
                        {showSecondSell ? (
                          <SellPctPill
                            pct={secondSellPct}
                            onSell={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pulseBuyDisabled) return;
                              onPulseQuickSell?.(token.mint);
                            }}
                            loading={false}
                            disabled={pulseBuyDisabled}
                            pulseFit={pulseRow}
                            className="pointer-events-auto"
                          />
                        ) : null}
                        {showSecondBuy && secondBuySol > 0 ? (
                          <QuickBuyPill
                            quickBuySol={secondBuySol}
                            style={filledBuyStyle}
                            onBuy={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pulseBuyDisabled) return;
                              onPulseSecondBuy?.(token.mint);
                            }}
                            loading={false}
                            disabled={pulseBuyDisabled}
                            pulseFit={pulseRow}
                            quoteSymbol={quoteSymbol}
                            className="pointer-events-auto"
                          />
                        ) : null}
                        {hasPrimaryBuy ? (
                          <QuickBuyPill
                            quickBuySol={quickBuySol}
                            style={filledBuyStyle}
                            onBuy={onQuickBuy}
                            loading={false}
                            disabled={pulseBuyDisabled}
                            pulseFit={pulseRow}
                            quoteSymbol={quoteSymbol}
                            className={cn(
                              'pointer-events-auto',
                              filledBuyStyle === 'large' && pulseRow && 'mt-auto w-[calc(100%-0.5rem)]',
                            )}
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>
          ) : hasRightActions ? (
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
                              if (pulseBuyDisabled) return;
                              onPulseQuickSell?.(token.mint);
                            }}
                            loading={false}
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
                              if (pulseBuyDisabled) return;
                              onPulseSecondBuy?.(token.mint);
                            }}
                            loading={false}
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
                            loading={false}
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
                            if (pulseBuyDisabled) return;
                            onPulseQuickSell?.(token.mint);
                          }}
                          loading={false}
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
                            if (pulseBuyDisabled) return;
                            onPulseSecondBuy?.(token.mint);
                          }}
                          loading={false}
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
                          loading={false}
                          disabled={pulseBuyDisabled}
                          pulseFit={slotHeight != null}
                          quoteSymbol={quoteSymbol}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null
        ) : null}
      </>
    </div>
  );
}

function pulseDockWidthClass(
  ultra: boolean,
  ultraCompact: boolean,
  filledStyle: Exclude<BuyButtonStyle, 'ultra'>,
): string {
  // Names flow right up to the V/MC block (Axiom-style). The mins matter most in the
  // 2-column Pulse layout, where the % shrinks and the clamp hits the floor — lowered
  // so narrow columns stop cutting names early; max + % also trimmed. Kept in lockstep
  // with the reserve below so the name can never overlap the dock.
  if (ultra) {
    return ultraCompact
      ? 'w-[clamp(10rem,29%,12rem)]'
      : 'w-[clamp(6.75rem,26%,10rem)]';
  }
  if (filledStyle === 'small') return 'w-[clamp(5.5rem,23%,7.25rem)]';
  if (filledStyle === 'large') return 'w-[clamp(8.5rem,30%,11.5rem)]';
  return 'w-[clamp(6.25rem,26%,9.5rem)]';
}

function pulseDockReservePadding(
  ultra: boolean,
  ultraCompact: boolean,
  filledStyle: Exclude<BuyButtonStyle, 'ultra'>,
): string {
  // Must stay in lockstep with pulseDockWidthClass above (same clamps + 0.5rem gap)
  // so the name reserves exactly the dock width and can't overlap the V/MC or buy button.
  if (ultra) {
    return ultraCompact
      ? 'pr-[calc(clamp(10rem,29%,12rem)+0.5rem)]'
      : 'pr-[calc(clamp(6.75rem,26%,10rem)+0.5rem)]';
  }
  if (filledStyle === 'small') return 'pr-[calc(clamp(5.5rem,23%,7.25rem)+0.5rem)]';
  if (filledStyle === 'large') return 'pr-[calc(clamp(8.5rem,30%,11.5rem)+0.5rem)]';
  return 'pr-[calc(clamp(6.25rem,26%,9.5rem)+0.5rem)]';
}

function quickBuyPillSizeClasses(
  style: Exclude<BuyButtonStyle, 'ultra'>,
  pulseFit?: boolean,
): string {
  const base =
    'btn-press focus-ring inline-flex min-w-0 max-w-full items-center justify-center font-sans tabular-nums leading-none transition-colors';

  switch (style) {
    case 'small':
      return cn(
        base,
        'pulse-qb-pill pulse-qb-pill--small',
        pulseFit
          ? 'h-6 max-h-6 gap-0.5 rounded px-1.5 text-[10px] font-medium'
          : 'h-7 gap-1 rounded-md px-2 text-[10px] font-medium',
      );
    case 'large':
      return cn(
        base,
        'pulse-qb-pill pulse-qb-pill--large',
        pulseFit
          ? 'h-11 min-h-[2.75rem] max-h-12 gap-1.5 rounded-[6px] px-3 text-xs font-semibold'
          : 'h-10 min-h-10 gap-1.5 rounded-md px-4 text-xs font-semibold',
      );
    case 'medium':
    default:
      return cn(
        base,
        'pulse-qb-pill pulse-qb-pill--medium',
        pulseFit
          ? 'h-8 max-h-8 min-h-8 gap-1 rounded-md px-2.5 text-[11px] font-medium'
          : 'h-8 gap-1 rounded-md px-2.5 text-[11px] font-medium',
      );
  }
}

function quickBuyPillIconClass(style: Exclude<BuyButtonStyle, 'ultra'>): string {
  if (style === 'small') return 'pulse-qb-icon h-2.5 w-2.5 shrink-0';
  if (style === 'large') return 'pulse-qb-icon pulse-qb-icon--on h-3.5 w-3.5 shrink-0';
  return 'pulse-qb-icon h-3 w-3 shrink-0';
}

function QuickBuyPill({
  quickBuySol,
  style,
  onBuy,
  loading,
  disabled,
  pulseFit,
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

  const btn = cn(
    quickBuyPillSizeClasses(style, pulseFit),
    disabled && 'pointer-events-none opacity-55',
    className,
  );

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled}
      className={btn}
      aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
    >
      {loading ? (
        <Loader2 className={cn(quickBuyPillIconClass(style), 'animate-spin')} aria-hidden />
      ) : (
        <Zap className={cn(quickBuyPillIconClass(style), 'inline')} aria-hidden />
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
      disabled={disabled}
      className={cn(
        'btn-press focus-ring pointer-events-auto inline-flex min-w-0 max-w-full items-center justify-center rounded-md border border-red-400/45 bg-bg-base/95 font-sans font-semibold tabular-nums tracking-normal text-red-300/95 transition hover:border-red-400/70 hover:bg-red-500/10',
        sizeCls,
        disabled && 'pointer-events-none opacity-55',
        className,
      )}
      title={`Sell ${pct}% of your balance for this token`}
      aria-label={`Sell ${pct} percent`}
    >
      <span>{`Sell ${pct}%`}</span>
    </button>
  );
}

/**
 * Ultra quick-buy zone:
 * - `filled=false` (default): outline overlay — bg-transparent + emerald border + emerald text.
 *   Used when `buyButtonStyle === 'ultra'`.
 * - `filled=true`: solid filled rectangle — emerald bg + dark text. Used for `small`/`medium`/`large`.
 *   Same dock-filling geometry (h-full w-full) so the layout doesn't shift between modes.
 */
function UltraQuickBuyZone({
  quickBuySol,
  quoteSymbol,
  onBuy,
  loading,
  disabled,
  pulseGrid: _pulseGrid = false,
  filled = false,
  ultraChromeStyle = 'outline',
}: {
  quickBuySol: number;
  quoteSymbol: string;
  onBuy: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Pulse grid callers pass this for API compat; styling matches the classic square Ultra outline only. */
  pulseGrid?: boolean;
  /** Toggle solid fill (non-ultra buyButtonStyle). Default false keeps the Axiom outline look. */
  filled?: boolean;
  ultraChromeStyle?: QuickBuyUltraChrome;
}) {
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);
  const useFilled = filled || ultraChromeStyle === 'filled';
  const borderless = ultraChromeStyle === 'borderless';
  // Cursor-following spotlight for the outline zone (GMGN/Axiom). The glow span
  // is inset-0 + rounded, so it's self-clipped — NO overflow-hidden on the
  // button (that would kill the outline's `backdrop-filter: blur` hover effect).
  const showGlow = !useFilled;
  const onGlowMove = showGlow
    ? (e: MouseEvent<HTMLButtonElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--qb-mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--qb-my', `${e.clientY - r.top}px`);
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onBuy}
      onMouseMove={onGlowMove}
      disabled={disabled}
      className={cn(
        /**
         * Shared chrome — transition, focus ring, rounded corners.
         * Geometry per mode:
         *   - outline: `h-full w-full` full-bleed rectangle, chip in bottom-right.
         *   - filled: short bar pinned to the bottom of the dock, pulled in from
         *     the right edge + lifted off the bottom edge so it reads as a button,
         *     not a flush slab. Chip centered, V/MC stays visible above.
         */
        'pulse-qb-ultra group/qb focus-ring pointer-events-auto relative z-[21] flex min-h-0 max-h-full max-w-full rounded-[5px] border font-sans font-semibold tabular-nums tracking-normal',
        useFilled ? 'pulse-qb-ultra--filled transition-[filter] duration-200' : 'pulse-qb-ultra--outline',
        borderless && !useFilled && 'pulse-qb-ultra--borderless',
        useFilled
          ? 'h-1/3 w-[calc(100%-0.625rem)] self-end mr-2.5 mb-2 items-center justify-center px-2 py-1'
          : 'h-full w-full flex-col items-end justify-end p-2 pb-2.5 pr-2.5',
        'disabled:pointer-events-none disabled:opacity-55',
      )}
      aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
    >
      {showGlow ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-[5px] opacity-0 transition-opacity duration-150 group-hover/qb:opacity-100"
          style={{
            background:
              'radial-gradient(60px circle at var(--qb-mx, 50%) var(--qb-my, 50%), rgb(var(--pulse-accent-rgb) / 0.25), transparent 70%)',
          }}
        />
      ) : null}
      <span
        className={cn(
          'relative z-[1] flex shrink-0 items-center gap-1 text-[10px] leading-none sm:text-[11px]',
          loading && 'opacity-0',
        )}
      >
        <Zap
          className={cn(
            'pulse-qb-icon h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5',
            useFilled && 'pulse-qb-icon--on',
          )}
          aria-hidden
        />
        <span className="min-w-0 text-right">{`${labelAmount} ${quoteSymbol}`}</span>
      </span>
      {loading ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2
            className={cn(
              'pulse-qb-icon h-4 w-4 shrink-0 animate-spin',
              useFilled && 'pulse-qb-icon--on',
            )}
          />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Ultra sell: outline (default) or filled (non-ultra buyButtonStyle). Same sizing
 * geometry as UltraQuickBuyZone — switches surface treatment only.
 */
function UltraSellZone({
  pct,
  onSell,
  loading,
  disabled,
  pulseGrid: _pulseGrid = false,
  filled = false,
}: {
  pct: number;
  onSell: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  pulseGrid?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSell}
      disabled={disabled}
      className={cn(
        'focus-ring pointer-events-auto relative z-[21] flex min-h-0 max-h-full max-w-full rounded-[5px] border font-semibold tabular-nums transition-all duration-200',
        filled
          ? 'h-1/3 w-[calc(100%-0.625rem)] self-end mr-2.5 mb-2 items-center justify-center px-2 py-1'
          : 'h-full w-full flex-col items-end justify-end p-2 pb-2.5 pr-2.5',
        filled
          ? cn(
              'border-rose-400/85 bg-rose-500 text-[#1a0407]',
              'shadow-[0_4px_22px_-10px_rgba(251,113,133,0.65)]',
              'hover:border-rose-300 hover:bg-rose-400',
              'active:bg-rose-600 active:border-rose-500',
            )
          : cn(
              'border-rose-400/85 bg-transparent text-rose-300',
              'shadow-[0_0_12px_-14px_rgba(251,113,133,0.32)] backdrop-blur-none',
              'hover:border-rose-300/95 hover:bg-rose-500/[0.1] hover:shadow-[0_0_16px_-12px_rgba(251,113,133,0.42)] hover:backdrop-blur-[6px]',
              'active:bg-rose-500/14 active:backdrop-blur-sm',
            ),
        'disabled:pointer-events-none disabled:opacity-55',
      )}
      title={`Sell ${pct}% of your balance for this token`}
      aria-label={`Sell ${pct} percent`}
    >
      <span
        className={cn(
          'shrink-0 text-right text-[10px] leading-none sm:text-[11px]',
          loading && 'opacity-0',
        )}
      >
        {`Sell ${pct}%`}
      </span>
      {loading ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2
            className={cn('h-3.5 w-3.5 shrink-0 animate-spin', filled ? 'text-[#1a0407]' : 'text-rose-300')}
          />
        </span>
      ) : null}
    </button>
  );
}

function formatSolDraft(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) return '';
  const t = sol.toFixed(8).replace(/\.?0+$/, '');
  return t || String(sol);
}

type TokenRowProps = Parameters<typeof TokenRowInner>[0];

function tokenRowPropsEqual(prev: TokenRowProps, next: TokenRowProps): boolean {
  if (prev.bundle.token.mint !== next.bundle.token.mint) return false;
  if (prev.bundle.token.last_seen_at !== next.bundle.token.last_seen_at) return false;
  if (prev.bundle.token.migrated_at !== next.bundle.token.migrated_at) return false;
  if (prev.bundle.token.launch_pad !== next.bundle.token.launch_pad) return false;
  if (prev.bundle.token.bonding_progress !== next.bundle.token.bonding_progress) return false;
  if (prev.bundle.token.image_url !== next.bundle.token.image_url) return false;
  if (prev.bundle.snapshot !== next.bundle.snapshot) return false;
  if (prev.display !== next.display) return false;
  if (prev.quickBuySol !== next.quickBuySol) return false;
  if (prev.buyButtonStyle !== next.buyButtonStyle) return false;
  if (prev.pulseBuyBusy !== next.pulseBuyBusy) return false;
  if (prev.pulseBuyDisabled !== next.pulseBuyDisabled) return false;
  if (prev.slotHeight !== next.slotHeight) return false;
  if (prev.columnId !== next.columnId) return false;
  if (prev.quoteSymbol !== next.quoteSymbol) return false;
  if (prev.avatarImagePriority !== next.avatarImagePriority) return false;
  if (prev.onPulseQuickBuy !== next.onPulseQuickBuy) return false;
  if (prev.onPulseSecondBuy !== next.onPulseSecondBuy) return false;
  if (prev.onPulseQuickSell !== next.onPulseQuickSell) return false;
  return true;
}

export const TokenRow = memo(TokenRowInner, tokenRowPropsEqual);
