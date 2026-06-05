'use client';

import { useRouter } from 'next/navigation';
import {
  memo,
  startTransition,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Eye, Loader2, Zap } from 'lucide-react';
import { PulseRowSocialStrip } from '@/components/tokens/PulseRowSocialStrip';
import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import { PulseRowAxiomSpriteStrip } from '@/components/tokens/PulseRowAxiomSpriteStrip';
import { PulseRowBondingHoverTag } from '@/components/tokens/PulseRowBondingHoverTag';
import { PulseMayhemTimerBadge } from '@/components/tokens/PulseMayhemTimerBadge';
import { PulseRowAgeLabel } from '@/components/tokens/PulseRowAgeLabel';
import { PulseTokenAvatarHover } from '@/components/tokens/PulseTokenAvatarHover';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { syntheticPulseVolMc } from '@/lib/dev/demoTokenFixtures';
import type { BuyButtonStyle, ColumnDisplayOptions } from '@/lib/tokens/columnPresetModel';
import { getPulseRowTraitFlags } from '@/lib/tokens/pumpTokenSignals';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import {
  resolveLaunchpadAvatarChrome,
  resolveLaunchpadAvatarChromeWithFallback,
} from '@/lib/tokens/launchpadAvatarChrome';
import { alternateQuotePairKind, quotePairTooltip } from '@/lib/tokens/quoteToken';
import { resolvePulseTranslationGloss } from '@/lib/translate/pulseTranslationGloss';
import { useAutoTranslateStore } from '@/store/autoTranslate';
import { PulseMintCopyCaption } from '@/components/tokens/PulseMintCopyCaption';
import { cn } from '@/lib/utils/cn';
import { CopyButton } from '@/components/shared/CopyButton';
import { useUIStore } from '@/store/ui';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseRowDensity } from '@/store/pulseColumns';
import type { PulseTokenBundle } from '@/types/tokens';

type UltraActionKey = 'primaryBuy' | 'secondBuy' | 'secondSell';

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
}) {
  const router = useRouter();
  const { token, snapshot } = bundle;
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
  const heroMc = mcLayout === 'hero' && showMc && (slotHeight == null || showRowMc);
  const traits = useMemo(() => getPulseRowTraitFlags(bundle), [bundle]);
  const bond = useMemo(() => getPulseBondingRingState(bundle), [bundle]);
  const isMigratedVisual = columnId === 'migrated' || bond.migrated;
  const launchpadChrome = useMemo(() => {
    const opts = {
      showFrame: showPumpFrame,
      isMigrated: isMigratedVisual,
      pumpFunOnBondingCurve: traits.pumpFunBonding,
      chain: activeChain,
    };
    return isMigratedVisual
      ? resolveLaunchpadAvatarChromeWithFallback(bundle, opts)
      : resolveLaunchpadAvatarChrome(bundle, opts);
  }, [bundle, showPumpFrame, isMigratedVisual, traits.pumpFunBonding, activeChain]);

  /** Pulse virtualizer rows use a single locked footprint; ignore per-preset density there. */
  const layoutDensity: PulseRowDensity = slotHeight != null ? 'normal' : density ?? 'normal';

  /** Pulse grid: fill most of the slot height (Axiom-style). Else preference-driven rhythm. */
  const avatarSize = useMemo(() => {
    if (slotHeight != null) {
      const verticalPad = 24; // pt-4 + pb-2 on Pulse grid hit area
      const captionReserve = 15; // truncated mint + gap under avatar
      const raw = slotHeight - verticalPad - captionReserve;
      return Math.min(78, Math.max(44, Math.round(raw)));
    }
    if (layoutDensity === 'compact') return 48;
    if (layoutDensity === 'expanded') return 56;
    return 52;
  }, [slotHeight, layoutDensity]);

  /**
   * Strip icon size — bumped ~10% across the board so Pulse rows read closer to Axiom:
   *  - tall slot 112+: 26 → 29
   *  - mid  slot 96+ : 24 → 26
   *  - short slot     : 22 → 24
   *  - non-pulse densities: 22→24 / 24→26 / 28→31.
   */
  const socialGlyphSize = useMemo(() => {
    if (slotHeight != null) {
      if (slotHeight >= 112) return 29;
      if (slotHeight >= 96) return 26;
      return 24;
    }
    if (layoutDensity === 'expanded') return 31;
    if (layoutDensity === 'compact') return 24;
    return 26;
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
   * Pulse virtual rows (slotHeight != null) always render Ultra chrome — the
   * outline emerald square + stacked V/MC column. The store-level `buyButtonStyle`
   * still controls non-Pulse renderings.
   */
  const ultraChrome = buyButtonStyle === 'ultra' || slotHeight != null;
  /** Pulse virtual rows: Ultra squares must not stretch to full row height (Axiom uses small tiles). */
  const pulseUltraCompact = slotHeight != null && ultraChrome;
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


  /** Truncated mint under avatar — Axiom-style hover + custom copy chip (no browser title). */
  const mintCaption = (
    <PulseMintCopyCaption mint={token.mint} compact={slotHeight == null} />
  );

  const avatarStack = (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center',
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
    if (pulseBuyDisabled || pulseBuyBusy) return;
    if (quickBuySol == null || !Number.isFinite(quickBuySol) || quickBuySol <= 0) return;
    setActiveUltraAction('primaryBuy');
    onPulseQuickBuy?.(token.mint);
  }

  const tokenPath = `/token/${token.mint}`;
  const nameTitle = `${ticker} \u2014 ${name}`;

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
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
      {slotHeight != null ? (
        <div className="group/mintTitle flex min-w-0 max-w-full w-max flex-col gap-0.5 overflow-hidden">
          <div
            className={cn(
              'inline-flex w-fit max-w-full items-center gap-0.5 overflow-hidden rounded-sm px-0.5 -mx-0.5',
              'transition-colors hover:bg-white/[0.05]',
            )}
          >
            <p className="min-w-0 truncate font-sans leading-[1.12]" title={nameTitle}>
              <span className={cn('font-semibold text-fg-primary text-[16px] tracking-tight')}>
                {ticker}
              </span>
              <span className={cn('font-normal text-fg-secondary ml-1.5 text-[15px] tracking-tight')}>
                {name}
              </span>
            </p>
            <CopyButton
              value={token.mint}
              iconOnly
              label="Copy mint address"
              toastLabel="Mint address copied"
              className="shrink-0 opacity-80 transition group-hover/mintTitle:opacity-100"
              iconClassName="text-fg-muted/90 transition-colors group-hover/mintTitle:text-fg-secondary hover:!text-fg-primary"
            />
          </div>
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
          <p
            className={cn(
              'min-w-0 flex-1 truncate font-sans',
              'leading-tight',
            )}
            title={nameTitle}
          >
            <span
              className={cn(
                'font-semibold text-fg-primary',
                'text-[15px]',
              )}
            >
              {ticker}
            </span>
            <span
              className={cn(
                'font-normal text-fg-secondary',
                'ml-1.5 text-[14px]',
              )}
            >
              {name}
            </span>
          </p>
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
      {showBadge ? (
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
  const alternateQuote = useMemo(
    () => alternateQuotePairKind(bundle, activeChain),
    [bundle, activeChain],
  );
  const quoteIconPx = slotHeight != null ? 14 : 13;
  const ageBadge = (
    <PulseRowAgeLabel createdAt={token.created_at} compact={slotHeight != null} />
  );
  const ageQuotePairBadge =
    alternateQuote != null ? (
      <span
        className="inline-flex shrink-0 items-center"
        title={quotePairTooltip(alternateQuote, activeChain)}
        aria-label={quotePairTooltip(alternateQuote, activeChain)}
      >
        <QuoteTokenIcon
          kind={alternateQuote}
          chain={activeChain}
          className="object-contain"
          style={{ width: quoteIconPx, height: quoteIconPx }}
        />
      </span>
    ) : null;
  const ageCluster = (
    <div className="inline-flex shrink-0 items-center gap-1">
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
  /**
   * Pulse dock always uses Ultra geometry (full-bleed rectangle in the right column).
   * The user-toggled `buyButtonStyle` chooses the surface treatment:
   *   - 'ultra' → outline (transparent fill, emerald border)
   *   - 'small' / 'medium' / 'large' → filled (emerald solid background)
   */
  const filledDockButton = buyButtonStyle !== 'ultra';

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
        mcTone={mcTone}
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
            'relative z-[1] flex min-h-0 min-w-0 flex-1 cursor-pointer items-start outline-none transition-[background-color] duration-150',
            'hover:bg-white/[0.04]',
            'focus-visible:bg-bg-hover/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/45',
            slotHeight != null ? 'px-3 pt-4 pb-2' : 'p-3',
            /**
             * Reservation MUST match the Ultra dock width formula below or token info
             * bleeds under the action column when the Pulse column is narrow.
             * `clamp()` lets the dock shrink with the column instead of pinning at min-w.
             */
            reserveRightActionCol &&
              (pulseUltraCompact
                ? 'pr-[calc(clamp(11rem,35%,16rem)+0.5rem)]'
                : 'pr-[calc(clamp(7.5rem,32%,14rem)+0.5rem)]'),
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
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                <div className="block min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                    {identityCluster}
                    {heroMcBlock}
                  </div>
                </div>
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
                      mcTone={mcTone}
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
                  {/**
                   * Age column + shared text column: metric pills align under @handle / icons
                   * (never under the avatar). Horizontal scroll contains overflow in-column.
                   */}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-stretch gap-2 overflow-hidden">
                    <div className="shrink-0 self-start pt-px">{ageCluster}</div>
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
                      <div
                        className={cn(
                          'relative mt-auto min-w-0 w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain pt-1.5',
                          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
                        )}
                      >
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
                  </div>
                </div>
              ) : (
                <div className={cn('min-w-0 space-y-0.5', 'mt-0.5 pt-1')}>
                  <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
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
                  'pointer-events-auto relative z-[21] flex h-full min-h-0 min-w-0 shrink-0 flex-col gap-0.5',
                  pulseUltraCompact
                    ? 'w-[clamp(11rem,35%,16rem)]'
                    : 'w-[clamp(7.5rem,32%,14rem)]',
                )}
              >
                {(showVol || showMc) && !splitPairStrip ? (
                  <div
                    className={cn(
                      // Anchor V/MC to the top-right of the dock (Axiom-style header strip).
                      // `top-4` (~16px) gives the row-top breathing room Axiom uses; `pr-3`
                      // pulls the text in from the row's right edge instead of flush right.
                      'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-end pl-0.5 pr-3',
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
                      mcTone={mcTone}
                    />
                  </div>
                ) : null}
                <div
                  className={cn(
                    'relative z-[21] flex min-h-0 flex-1 gap-1.5 items-stretch',
                  )}
                >
                {splitPairStrip ? (
                  <>
                    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
                      {showVol ? (
                        <div
                          className={cn(
                            'pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-center px-0.5',
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
                            mcTone={mcTone}
                          />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          'relative z-[21] flex min-h-0 flex-1 justify-end items-stretch',
                        )}
                      >
                      {showSecondSell ? (
                        <UltraSellZone
                          pct={secondSellPct}
                          pulseGrid={pulseUltraCompact}
                          filled={filledDockButton}
                          onSell={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            setActiveUltraAction('secondSell');
                            onPulseQuickSell?.(token.mint);
                          }}
                          loading={pulseBuyBusy && activeUltraAction === 'secondSell'}
                          disabled={pulseBuyDisabled}
                        />
                      ) : showSecondBuy && secondBuySol > 0 ? (
                        <UltraQuickBuyZone
                          quickBuySol={secondBuySol}
                          quoteSymbol={quoteSymbol}
                          pulseGrid={pulseUltraCompact}
                          filled={filledDockButton}
                          onBuy={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (pulseBuyDisabled || pulseBuyBusy) return;
                            setActiveUltraAction('secondBuy');
                            onPulseSecondBuy?.(token.mint);
                          }}
                          loading={pulseBuyBusy && activeUltraAction === 'secondBuy'}
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
                            mcTone={mcTone}
                          />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          'relative z-[21] flex min-h-0 flex-1 justify-end items-stretch',
                        )}
                      >
                      {hasPrimaryBuy ? (
                        <UltraQuickBuyZone
                          quickBuySol={quickBuySol}
                          quoteSymbol={quoteSymbol}
                          pulseGrid={pulseUltraCompact}
                          filled={filledDockButton}
                          onBuy={onQuickBuy}
                          loading={pulseBuyBusy && activeUltraAction === 'primaryBuy'}
                          disabled={pulseBuyDisabled}
                        />
                      ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className={cn(
                      'flex min-h-0 min-w-0 flex-1 justify-end gap-1.5 items-stretch',
                    )}
                  >
                    {showSecondSell ? (
                      <UltraSellZone
                        pct={secondSellPct}
                        pulseGrid={pulseUltraCompact}
                        filled={filledDockButton}
                        onSell={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (pulseBuyDisabled || pulseBuyBusy) return;
                          setActiveUltraAction('secondSell');
                          onPulseQuickSell?.(token.mint);
                        }}
                        loading={pulseBuyBusy && activeUltraAction === 'secondSell'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                    {showSecondBuy && secondBuySol > 0 ? (
                      <UltraQuickBuyZone
                        quickBuySol={secondBuySol}
                        quoteSymbol={quoteSymbol}
                        pulseGrid={pulseUltraCompact}
                        filled={filledDockButton}
                        onBuy={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (pulseBuyDisabled || pulseBuyBusy) return;
                          setActiveUltraAction('secondBuy');
                          onPulseSecondBuy?.(token.mint);
                        }}
                        loading={pulseBuyBusy && activeUltraAction === 'secondBuy'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                    {hasPrimaryBuy ? (
                      <UltraQuickBuyZone
                        quickBuySol={quickBuySol}
                        quoteSymbol={quoteSymbol}
                        pulseGrid={pulseUltraCompact}
                        filled={filledDockButton}
                        onBuy={onQuickBuy}
                        loading={pulseBuyBusy && activeUltraAction === 'primaryBuy'}
                        disabled={pulseBuyDisabled}
                      />
                    ) : null}
                  </div>
                )}
                </div>
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
                              onPulseQuickSell?.(token.mint);
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
                              onPulseSecondBuy?.(token.mint);
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
                            onPulseQuickSell?.(token.mint);
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
                            onPulseSecondBuy?.(token.mint);
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
}) {
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled || loading}
      className={cn(
        /**
         * Shared chrome — transition, focus ring, rounded corners.
         * Geometry per mode:
         *   - outline: `h-full w-full` full-bleed rectangle, chip in bottom-right.
         *   - filled: short bar pinned to the bottom of the dock, pulled in from
         *     the right edge + lifted off the bottom edge so it reads as a button,
         *     not a flush slab. Chip centered, V/MC stays visible above.
         */
        'focus-ring relative z-[21] flex min-h-0 max-h-full max-w-full rounded-[5px] border font-sans font-semibold tabular-nums tracking-normal transition-all duration-200',
        filled
          ? 'h-1/3 w-[calc(100%-0.625rem)] self-end mr-2.5 mb-2 items-center justify-center px-2 py-1'
          : 'h-full w-full flex-col items-end justify-end p-2 pb-2.5 pr-2.5',
        filled
          ? cn(
              'border-emerald-400/90 bg-emerald-400 text-[#030806]',
              'shadow-[0_4px_22px_-10px_rgba(52,211,153,0.65)]',
              'hover:border-emerald-300 hover:bg-emerald-300',
              'active:bg-emerald-500 active:border-emerald-400',
            )
          : cn(
              'border-emerald-400/90 bg-transparent text-emerald-400',
              'shadow-[0_0_14px_-14px_rgba(52,211,153,0.38)] backdrop-blur-none',
              'hover:border-emerald-300/95 hover:bg-emerald-400/[0.08] hover:shadow-[0_0_18px_-12px_rgba(52,211,153,0.48)] hover:backdrop-blur-[6px]',
              'active:border-emerald-300 active:bg-emerald-400/12 active:backdrop-blur-sm',
            ),
        'disabled:pointer-events-none disabled:opacity-55',
      )}
      title={`Quick trade: ${labelAmount} ${quoteSymbol} on this mint`}
      aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2
          className={cn(
            'absolute left-1/2 top-1/2 h-4 w-4 shrink-0 -translate-x-1/2 -translate-y-1/2 animate-spin',
            filled ? 'text-[#030806]' : 'text-emerald-400',
          )}
          aria-hidden
        />
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[10px] leading-none sm:text-[11px]">
          <Zap
            className={cn(
              'h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5',
              filled ? 'fill-[#030806] text-[#030806]' : 'fill-emerald-400/35 text-emerald-400',
            )}
            aria-hidden
          />
          <span className="min-w-0 text-right">{`${labelAmount} ${quoteSymbol}`}</span>
        </span>
      )}
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
      disabled={disabled || loading}
      className={cn(
        'focus-ring relative z-[21] flex min-h-0 max-h-full max-w-full rounded-[5px] border font-semibold tabular-nums transition-all duration-200',
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
      {loading ? (
        <Loader2
          className={cn(
            'absolute left-1/2 top-1/2 h-3.5 w-3.5 shrink-0 -translate-x-1/2 -translate-y-1/2 animate-spin',
            filled ? 'text-[#1a0407]' : 'text-rose-300',
          )}
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
