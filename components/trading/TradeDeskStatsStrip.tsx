'use client';

import type { ReactNode } from 'react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { formatCompactNumber } from '@/lib/format';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { formatNumber } from '@/lib/utils/formatters';
import {
  TerminalNativeBalance,
  TerminalNativeTradePnl,
  TerminalUsdPrice,
  TerminalUsdTradePnl,
} from '@/lib/utils/terminalBalanceFormat';
import { cn } from '@/lib/utils/cn';

type TradeDeskStatsStripProps = {
  activeChain: AppChainId;
  nativeSym: string;
  usdMode: boolean;
  onToggleUsd: () => void;
  bought: number;
  sold: number;
  /** Primary holding figure — SOL or USD depending on `usdMode`. */
  holding: number;
  holdingSol: number;
  holdingUsd: number;
  holdingTokenUi: number;
  tokenSymbol: string;
  pnl: number;
  pnlPct: number | null;
  className?: string;
};

const STRIP_ROOT = 'font-sans tabular-nums';
const LABEL = 'text-[11px] font-medium leading-none text-fg-secondary';
/** Fixed label rail — keeps PnL toggle from shifting the row vs Bought/Sold/Holding. */
const LABEL_ROW = 'flex h-4 min-h-4 items-center justify-center gap-0.5';
const VALUE_ROW =
  'inline-flex h-4 min-h-4 max-w-full min-w-0 items-center justify-center gap-0.5 whitespace-nowrap text-[12px] font-medium leading-none tabular-nums';
/** Match cap height of 12px figures — not oversized chain marks. */
const CHAIN_ICON = 'size-[10px] shrink-0 object-contain opacity-95';

function CurrencyToggle({
  usdMode,
  nativeSym,
  onToggle,
}: {
  usdMode: boolean;
  nativeSym: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${usdMode ? nativeSym : 'USD'}`}
      aria-label={`Currency: ${usdMode ? 'USD' : nativeSym}. Click to switch.`}
      className={cn(
        'inline-flex size-3 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors',
        'hover:bg-bg-hover/80 hover:text-fg-primary',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        width="8"
        height="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 5h8" />
        <path d="M9 3l2 2-2 2" />
        <path d="M13 11H5" />
        <path d="M7 13l-2-2 2-2" />
      </svg>
    </button>
  );
}

function StatColumn({
  label,
  valueClassName,
  children,
  labelExtra,
  interactive = false,
}: {
  label: string;
  valueClassName: string;
  children: ReactNode;
  labelExtra?: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2',
        interactive && 'transition-colors hover:bg-bg-hover/40',
      )}
    >
      <div className={LABEL_ROW}>
        <span className={LABEL}>{label}</span>
        {labelExtra}
      </div>
      <div className={cn(VALUE_ROW, valueClassName)}>{children}</div>
    </div>
  );
}

function formatHoldingTokenAmount(amount: number): ReactNode {
  if (!Number.isFinite(amount) || amount === 0) {
    return '0';
  }
  if (amount >= 1000) {
    return formatCompactNumber(amount);
  }
  if (amount >= 1) {
    const t = formatNumber(amount, { decimals: 2 }).replace(/\.?0+$/, '');
    return t || '0';
  }
  return <TerminalNativeBalance amount={amount} />;
}

function HoldingBreakdownRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] leading-none">
      <span className="text-fg-muted">{label}</span>
      <span className="font-semibold tabular-nums text-fg-primary">{children}</span>
    </div>
  );
}

function HoldingStatColumn({
  usdMode,
  holding,
  holdingTokenUi,
  holdingSol,
  holdingUsd,
  tokenSymbol,
  nativeSym,
  activeChain,
}: {
  usdMode: boolean;
  holding: number;
  holdingTokenUi: number;
  holdingSol: number;
  holdingUsd: number;
  tokenSymbol: string;
  nativeSym: string;
  activeChain: AppChainId;
}) {
  const sym = tokenSymbol.trim().toUpperCase() || 'TKN';

  const restingValue = usdMode ? (
    <TerminalUsdPrice price={holding} />
  ) : (
    <>
      <img
        src={CHAIN_ICON_PNG[activeChain]}
        alt=""
        width={10}
        height={10}
        className={CHAIN_ICON}
        draggable={false}
        aria-hidden
      />
      <TerminalNativeBalance amount={holdingSol} />
    </>
  );

  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 flex-col items-stretch border-0 bg-transparent p-0 text-inherit outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40"
          aria-label={`Holding — ${holdingTokenUi} ${sym}`}
        >
          <StatColumn label="Holding" valueClassName="text-fg-primary" interactive>
            {restingValue}
          </StatColumn>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="z-[320] w-auto min-w-[9.5rem] border-border-subtle bg-bg-raised px-2.5 py-2 shadow-panel"
      >
        <div className="space-y-1.5">
          <HoldingBreakdownRow label="Tokens">
            {formatHoldingTokenAmount(holdingTokenUi)} {sym}
          </HoldingBreakdownRow>
          <HoldingBreakdownRow label={nativeSym}>
            <span className="inline-flex items-center gap-1">
              <img
                src={CHAIN_ICON_PNG[activeChain]}
                alt=""
                width={10}
                height={10}
                className={CHAIN_ICON}
                draggable={false}
                aria-hidden
              />
              <TerminalNativeBalance amount={holdingSol} />
            </span>
          </HoldingBreakdownRow>
          <HoldingBreakdownRow label="USD">
            <TerminalUsdPrice price={holdingUsd} />
          </HoldingBreakdownRow>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Bought / Sold / Holding / PnL row — Axiom typography + alignment. */
export function TradeDeskStatsStrip({
  activeChain,
  nativeSym,
  usdMode,
  onToggleUsd,
  bought,
  sold,
  holding,
  holdingSol,
  holdingUsd,
  holdingTokenUi,
  tokenSymbol,
  pnl,
  pnlPct,
  className,
}: TradeDeskStatsStripProps) {
  const chainIcon = !usdMode ? (
    <img
      src={CHAIN_ICON_PNG[activeChain]}
      alt=""
      width={10}
      height={10}
      className={CHAIN_ICON}
      draggable={false}
      aria-hidden
    />
  ) : null;

  const pnlTone = pnl >= 0 ? 'text-signal-bull' : 'text-signal-bear';

  return (
    <div
      className={cn(
        'flex w-full min-w-0 overflow-hidden rounded-md border border-border-subtle/50 bg-transparent',
        STRIP_ROOT,
        className,
      )}
    >
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] divide-x divide-border-subtle/40 py-0">
        <StatColumn label="Bought" valueClassName="text-signal-bull">
          {chainIcon}
          {usdMode ? <TerminalUsdPrice price={bought} /> : <TerminalNativeBalance amount={bought} />}
        </StatColumn>

        <StatColumn label="Sold" valueClassName="text-signal-bear">
          {chainIcon}
          {usdMode ? <TerminalUsdPrice price={sold} /> : <TerminalNativeBalance amount={sold} />}
        </StatColumn>

        <HoldingStatColumn
          usdMode={usdMode}
          holding={holding}
          holdingTokenUi={holdingTokenUi}
          holdingSol={holdingSol}
          holdingUsd={holdingUsd}
          tokenSymbol={tokenSymbol}
          nativeSym={nativeSym}
          activeChain={activeChain}
        />

        <StatColumn
          label="PnL"
          valueClassName={pnlTone}
          labelExtra={
            <CurrencyToggle usdMode={usdMode} nativeSym={nativeSym} onToggle={onToggleUsd} />
          }
        >
          {chainIcon}
          {usdMode ? (
            <TerminalUsdTradePnl pnl={pnl} pct={pnlPct} />
          ) : (
            <TerminalNativeTradePnl pnl={pnl} pct={pnlPct} />
          )}
        </StatColumn>
      </div>
    </div>
  );
}
