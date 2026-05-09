'use client';

import Link from 'next/link';
import { useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowUpRight, Eye, Loader2, Zap } from 'lucide-react';
import { NumberDisplay } from '@/components/shared/NumberDisplay';
import { WalletDisplay } from '@/components/shared/WalletDisplay';
import { PulseRowMetaPills } from '@/components/tokens/PulseRowMetaPills';
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
import { formatAgeShort, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseRowDensity } from '@/store/pulseColumns';
import type { PulseTokenBundle } from '@/types/tokens';

export function TokenRow({
  bundle,
  density = 'normal',
  display,
  quickBuySol,
  buyButtonStyle = 'medium',
  onPulseQuickBuy,
  pulseBuyBusy = false,
  pulseBuyDisabled = false,
  columnId,
  /** Fixed pixel height from Pulse virtualizer — keeps every row the same size. */
  slotHeight,
  /** Native quote for quick-buy chip (TON / SOL / …). */
  quoteSymbol = 'TON',
}: {
  bundle: PulseTokenBundle;
  density?: PulseRowDensity;
  display?: ColumnDisplayOptions;
  quickBuySol?: number;
  buyButtonStyle?: BuyButtonStyle;
  /** Execute swap for this row’s mint using column header amount (labelled by `quoteSymbol`). */
  onPulseQuickBuy?: () => void;
  pulseBuyBusy?: boolean;
  pulseBuyDisabled?: boolean;
  /** Pulse board column (bonding ring semantics / gold on migrated lane). */
  columnId?: PulseColumnId;
  slotHeight?: number;
  quoteSymbol?: string;
}) {
  const { token, snapshot } = bundle;
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

  const txnsStrip = snapshot?.txns_1h ?? snapshot?.txns_5m ?? null;
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

  const avatarSize =
    slotHeight != null && slotHeight < 88
      ? 40
      : layoutDensity === 'compact'
        ? 44
        : layoutDensity === 'expanded'
          ? 60
          : 52;
  const rowMinH =
    layoutDensity === 'compact'
      ? 'min-h-[68px]'
      : layoutDensity === 'expanded'
        ? 'min-h-[92px]'
        : 'min-h-[76px]';
  const py =
    layoutDensity === 'compact' ? 'py-2' : layoutDensity === 'expanded' ? 'py-3' : 'py-2.5';
  const effectivePy = slotHeight != null ? 'py-1' : py;
  const titleSize =
    layoutDensity === 'compact'
      ? 'text-[14px]'
      : layoutDensity === 'expanded'
        ? 'text-[16px]'
        : 'text-[15px]';
  const nameSize =
    layoutDensity === 'compact'
      ? 'text-[12px]'
      : layoutDensity === 'expanded'
        ? 'text-[14px]'
        : 'text-[13px]';
  const metricSize =
    layoutDensity === 'compact'
      ? 'text-[11px]'
      : layoutDensity === 'expanded'
        ? 'text-[13px]'
        : 'text-[12px]';

  const devWallet = token.creator_wallet;
  const trackedDev =
    !!devWallet && showDev && isTracked(devWallet);
  const trackedDevLabel = trackedDev ? labelFor(devWallet) : null;
  const ultraChrome = buyButtonStyle === 'ultra';
  const canQuickBuy =
    quickBuySol != null && Number.isFinite(quickBuySol) && quickBuySol > 0;

  const showPumpCorner = token.launch_pad === 'pump.fun';

  const mintCaption = (
    <span
      className="max-w-[5rem] truncate text-center tabular-nums text-[9px] leading-tight text-fg-muted/85"
      title={token.mint}
    >
      {shortenAddress(token.mint, 4)}
      {token.mint.toLowerCase().endsWith('pump') ? (
        <span className="text-emerald-400/75"> · launchpad</span>
      ) : null}
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
    onPulseQuickBuy?.();
  }

  function onUltraPaneClick(e: MouseEvent<HTMLDivElement>) {
    if (!canQuickBuy || pulseBuyDisabled || pulseBuyBusy) return;
    if ((e.target as HTMLElement).closest('a')) return;
    e.preventDefault();
    e.stopPropagation();
    triggerQuickBuy();
  }

  function onUltraPaneKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!canQuickBuy || pulseBuyDisabled || pulseBuyBusy) return;
    e.preventDefault();
    e.stopPropagation();
    triggerQuickBuy();
  }

  const nameTitle = `${ticker} — ${name}`;

  /** Single primary line: ticker + full name never wrap (Axiom-style). */
  const nameCluster = (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
      <p className="min-w-0 flex-1 truncate leading-tight" title={nameTitle}>
        <span className={cn('font-semibold text-fg-primary', titleSize)}>{ticker}</span>
        <span className={cn('font-medium text-fg-secondary', nameSize)}> {name}</span>
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
  const ageSpan = (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap tabular-nums tabular-nums text-fg-muted',
        metricSize,
      )}
    >
      {formatAgeShort(token.created_at)}
    </span>
  );

  const volMcSize =
    layoutDensity === 'compact'
      ? 'compact'
      : layoutDensity === 'expanded'
        ? 'expanded'
        : 'normal';

  const heroMcBlock =
    heroMc && (showVol || showMc) ? (
      <PulseRowVolMc
        vol={vol}
        mcUsd={mcUsd}
        showVol={showVol}
        showMc={showMc}
        size={slotHeight != null ? 'compact' : volMcSize}
        justify="end"
      />
    ) : null;

  const axiomVolMcForStrip = !heroMc && !ultraChrome && (showVol || showMc) ? (
    <div className="mt-1">
      <PulseRowVolMc
        vol={vol}
        mcUsd={mcUsd}
        showVol={showVol}
        showMc={showMc}
        size={volMcSize}
        justify="start"
      />
    </div>
  ) : null;

  const metricsStrip = (
    <div
      className={cn(
        'flex items-center gap-x-3 tabular-nums tabular-nums leading-snug text-fg-muted',
        metricSize,
        !ultraChrome && 'mt-1',
        slotHeight != null
          ? 'max-w-full flex-nowrap overflow-hidden'
          : 'flex-wrap gap-y-0.5',
      )}
    >
      {axiomVolMcForStrip}
      {(() => {
        const metrics: ReactNode[] = [];
        if (showLiq) {
          metrics.push(
            <Metric
              key="liq"
              label="LIQ"
              value={
                <NumberDisplay value={snapshot?.liquidity_usd} compact className="text-fg-secondary" />
              }
            />,
          );
        }
        if (showHolders) {
          metrics.push(
            <Metric
              key="tx"
              label="TX"
              value={
                <span className="text-fg-secondary">
                  {txnsStrip != null ? formatNumber(txnsStrip, { decimals: 0 }) : '--'}
                </span>
              }
            />,
          );
        }
        if (showDev && token.creator_wallet) {
          metrics.push(
            <span key="dev" className="inline-flex items-center gap-1" title={token.creator_wallet}>
              <span className="text-fg-muted">dev</span>
              <WalletDisplay
                address={token.creator_wallet}
                href={`/wallet/${encodeURIComponent(token.creator_wallet)}`}
                truncate={3}
              />
            </span>,
          );
        }
        return metrics.flatMap((m, i) => (i === 0 ? [m] : [<Sep key={`sep-${i}`} />, m]));
      })()}
    </div>
  );

  return (
    <div
      role={trackedDev ? 'group' : undefined}
      aria-label={
        trackedDev
          ? `Token row, tracked dev${trackedDevLabel ? `: ${trackedDevLabel}` : ''}`
          : undefined
      }
      className={cn(
        'group relative flex items-stretch border-b border-border-subtle bg-bg-base outline-none transition-colors duration-150',
        slotHeight != null
          ? 'h-full min-h-0 max-h-full overflow-hidden'
          : rowMinH,
        trackedDev && 'bg-accent-primary/[0.08]',
        'hover:bg-bg-hover',
      )}
      style={slotHeight != null ? { height: slotHeight } : undefined}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-px transition',
          trackedDev
            ? 'bg-accent-primary opacity-100'
            : 'bg-accent-primary opacity-0 group-hover:opacity-100',
        )}
      />

      {ultraChrome ? (
        <>
          <Link
            href={`/token/${token.mint}`}
            className={cn(
              'flex min-h-0 min-w-0 flex-1 items-center px-3 outline-none focus-visible:bg-bg-hover',
              effectivePy,
            )}
            {...hoverProps}
          >
            <div className="flex h-full min-h-0 w-full min-w-0 items-center gap-3">
              {avatarStack}
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                  {identityCluster}
                  {ageSpan}
                </div>
                <PulseRowSocialStrip
                  bundle={bundle}
                  traits={{
                    cashback: showTraitIcons && traits.cashback,
                    feeShare: showTraitIcons && traits.feeShare,
                    agent: showTraitIcons && traits.agent,
                  }}
                  compact={false}
                  glyphSize={
                    layoutDensity === 'compact' ? 20 : layoutDensity === 'expanded' ? 28 : 24
                  }
                />
                <PulseRowMetaPills bundle={bundle} />
              </div>
            </div>
          </Link>

          <div
            className={cn(
              'mr-2 flex min-h-0 shrink-0 flex-col justify-center self-stretch rounded-xl border border-emerald-400/55',
              slotHeight != null
                ? 'max-h-[calc(100%-2px)] gap-0.5 overflow-hidden px-1.5 py-1'
                : 'gap-1 px-2 py-1.5',
              canQuickBuy &&
                !pulseBuyDisabled &&
                'cursor-pointer transition hover:bg-emerald-500/[0.08] active:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/55 focus-visible:ring-offset-0',
              canQuickBuy && pulseBuyDisabled && 'cursor-not-allowed opacity-60',
            )}
            role={canQuickBuy ? 'button' : undefined}
            tabIndex={canQuickBuy && !pulseBuyDisabled ? 0 : undefined}
            onClick={canQuickBuy ? onUltraPaneClick : undefined}
            onKeyDown={canQuickBuy ? onUltraPaneKeyDown : undefined}
            aria-label={
              canQuickBuy && quickBuySol != null
                ? `Quick buy ${formatSolDraft(quickBuySol) || String(quickBuySol)} ${quoteSymbol}, framed area`
                : undefined
            }
            aria-busy={pulseBuyBusy}
          >
            {(showVol || showMc) ? (
              <div className="flex w-full justify-end">
                <PulseRowVolMc
                  vol={vol}
                  mcUsd={mcUsd}
                  showVol={showVol}
                  showMc={showMc}
                  size={volMcSize}
                  justify="end"
                />
              </div>
            ) : null}
            {metricsStrip}
            {canQuickBuy || showRisk ? (
              <div className="mt-0.5 flex items-center justify-end gap-2">
                {canQuickBuy && quickBuySol != null ? (
                  <span
                    className={cn(
                      'pointer-events-none inline-flex items-center gap-1 font-sans font-semibold tabular-nums tracking-normal text-emerald-400/95',
                      slotHeight != null ? 'text-[10px]' : 'text-[12px]',
                    )}
                    aria-hidden
                  >
                    {pulseBuyBusy ? (
                      <Loader2
                        className={cn(
                          'shrink-0 animate-spin',
                          slotHeight != null ? 'h-3 w-3' : 'h-3.5 w-3.5',
                        )}
                        aria-hidden
                      />
                    ) : null}
                    {!pulseBuyBusy ? (
                      <>
                        <Zap
                          className={cn(
                            'shrink-0 fill-emerald-400/35 text-emerald-400',
                            slotHeight != null ? 'h-3 w-3' : 'h-3.5 w-3.5',
                          )}
                          aria-hidden
                        />
                        {`${formatSolDraft(quickBuySol)} ${quoteSymbol}`}
                      </>
                    ) : null}
                  </span>
                ) : null}
                {showRisk ? (
                  <RiskFlags token={token} snapshot={snapshot} className="shrink-0" />
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Link
            href={`/token/${token.mint}`}
            className={cn(
              'flex min-h-0 min-w-0 flex-1 items-center px-3 outline-none focus-visible:bg-bg-hover',
              effectivePy,
            )}
            {...hoverProps}
          >
            <div className="flex h-full min-h-0 w-full min-w-0 items-center gap-3">
              {avatarStack}
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                  {identityCluster}
                  {ageSpan}
                  {heroMcBlock}
                </div>
                <PulseRowSocialStrip
                  bundle={bundle}
                  traits={{
                    cashback: showTraitIcons && traits.cashback,
                    feeShare: showTraitIcons && traits.feeShare,
                    agent: showTraitIcons && traits.agent,
                  }}
                  compact
                  glyphSize={
                    layoutDensity === 'compact' ? 20 : layoutDensity === 'expanded' ? 28 : 24
                  }
                />
                <PulseRowMetaPills bundle={bundle} />
                {metricsStrip}
              </div>
            </div>
          </Link>

          {canQuickBuy && quickBuySol != null ? (
            <div
              className={cn(
                'flex shrink-0 items-center pr-2',
                effectivePy,
                buyButtonStyle === 'large' &&
                  slotHeight == null &&
                  'min-w-[4.5rem] flex-1 justify-end sm:min-w-[6.5rem]',
              )}
            >
              <QuickBuyPill
                quickBuySol={quickBuySol}
                style={buyButtonStyle}
                onBuy={onQuickBuy}
                loading={pulseBuyBusy}
                disabled={pulseBuyDisabled}
                pulseFit={slotHeight != null}
                quoteSymbol={quoteSymbol}
              />
            </div>
          ) : null}

          {showRisk ? (
            <div className={cn('flex shrink-0 items-center pr-2', effectivePy)}>
              <RiskFlags token={token} snapshot={snapshot} className="shrink-0" />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-fg-muted">{label}</span>
      {value}
    </span>
  );
}

function Sep() {
  return <span className="text-fg-muted/40">|</span>;
}

function QuickBuyPill({
  quickBuySol,
  style,
  onBuy,
  loading,
  disabled,
  pulseFit,
  quoteSymbol = 'TON',
}: {
  quickBuySol: number;
  style: Exclude<BuyButtonStyle, 'ultra'>;
  onBuy: (e: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Pulse grid: fixed row height — button must never force the row taller. */
  pulseFit?: boolean;
  quoteSymbol?: string;
}) {
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);

  const emphasisRing =
    pulseFit &&
    cn(
      style === 'large' && 'ring-2 ring-emerald-200/65 ring-offset-0 ring-offset-transparent',
      style === 'small' && 'ring-1 ring-emerald-400/30',
      style === 'medium' && 'ring-1 ring-emerald-200/45',
    );

  const sizeCls = pulseFit
    ? 'h-8 max-h-8 min-h-[28px] w-full gap-1 px-2 text-[10px] leading-none [&_svg]:h-2.5 [&_svg]:w-2.5'
    : style === 'small'
      ? 'min-h-7 gap-1 px-2.5 text-[9px] leading-none [&_svg]:h-2.5 [&_svg]:w-2.5'
      : style === 'medium'
        ? 'min-h-9 gap-1.5 px-3.5 text-[12px] leading-none [&_svg]:h-3.5 [&_svg]:w-3.5'
        : 'min-h-10 gap-1.5 px-4 text-[13px] leading-none [&_svg]:h-4 [&_svg]:w-4';

  const btn = cn(
    'btn-press focus-ring inline-flex min-w-0 max-w-full items-center justify-center rounded-xl border font-sans font-semibold tabular-nums tracking-normal transition',
    'shadow-[0_0_28px_-6px_rgba(16,185,129,0.65),0_2px_8px_-2px_rgba(0,0,0,0.5)]',
    'border-2 border-emerald-300/90 bg-emerald-400 text-[#030806] hover:border-emerald-200 hover:bg-emerald-300 active:bg-emerald-500 active:border-emerald-400',
    sizeCls,
    emphasisRing,
    (disabled || loading) && 'pointer-events-none opacity-55',
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
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" aria-hidden />
      ) : (
        <ArrowUpRight className="shrink-0" strokeWidth={style === 'small' ? 2.5 : 3} />
      )}
      <span className="max-w-[11rem] truncate sm:max-w-[14rem]">{`${labelAmount} ${quoteSymbol}`}</span>
    </button>
  );
}

function formatSolDraft(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) return '';
  const t = sol.toFixed(8).replace(/\.?0+$/, '');
  return t || String(sol);
}
