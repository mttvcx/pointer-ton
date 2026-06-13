'use client';

import type { ReactNode } from 'react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
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
  holding: number;
  pnl: number;
  pnlPct: number | null;
  className?: string;
};

const STRIP_ROOT = 'font-sans tabular-nums';
// Small, dim grey labels — match Axiom (no all-caps heaviness, no semibold).
const LABEL = 'text-[10px] font-normal normal-case text-fg-muted leading-none';
// Smaller, regular-weight values — match Axiom body density.
// Use `items-baseline` so subscript + parens all share the same text baseline as the other three cells.
const VALUE =
  'inline-flex max-w-full items-baseline justify-center gap-1 whitespace-nowrap text-[12px] font-medium leading-none tabular-nums';
const VALUE_PNL =
  'inline-flex min-w-0 max-w-full items-baseline justify-center gap-1 whitespace-nowrap text-[12px] font-medium leading-none tabular-nums';
const CHAIN_ICON = 'h-3 w-3 shrink-0 object-contain opacity-90 translate-y-[-1px]';

function CurrencyToggle({
  usdMode,
  nativeSym,
  onToggle,
}: {
  usdMode: boolean;
  nativeSym: string;
  onToggle: () => void;
}) {
  // Transparent icon-only toggle — hover surfaces a faint outline, no green fill.
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Switch to ${usdMode ? nativeSym : 'USD'}`}
      aria-label={`Currency: ${usdMode ? 'USD' : nativeSym}. Click to switch.`}
      className={cn(
        'group/toggle -mr-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors',
        'hover:bg-bg-hover/80 hover:text-fg-primary',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        width="10"
        height="10"
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
}: {
  label: string;
  valueClassName: string;
  children: ReactNode;
  labelExtra?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2">
      <span className={cn(LABEL, 'inline-flex items-center justify-center gap-1')}>
        <span>{label}</span>
        {labelExtra}
      </span>
      <span className={cn(VALUE, valueClassName)}>{children}</span>
    </div>
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
  pnl,
  pnlPct,
  className,
}: TradeDeskStatsStripProps) {
  const chainIcon = !usdMode ? (
    <img
      src={CHAIN_ICON_PNG[activeChain]}
      alt=""
      width={12}
      height={12}
      className={CHAIN_ICON}
      draggable={false}
      aria-hidden
    />
  ) : null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 overflow-hidden rounded-md border border-border-subtle/50 bg-transparent',
        STRIP_ROOT,
        className,
      )}
    >
      <div
        className="grid min-w-0 flex-1 divide-x divide-border-subtle/40 py-2"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.6fr)' }}
      >
        <StatColumn label="Bought" valueClassName="text-signal-bull">
          {chainIcon}
          {usdMode ? <TerminalUsdPrice price={bought} /> : <TerminalNativeBalance amount={bought} />}
        </StatColumn>

        <StatColumn label="Sold" valueClassName="text-signal-bear">
          {chainIcon}
          {usdMode ? <TerminalUsdPrice price={sold} /> : <TerminalNativeBalance amount={sold} />}
        </StatColumn>

        <StatColumn label="Holding" valueClassName="text-fg-primary">
          {chainIcon}
          {usdMode ? <TerminalUsdPrice price={holding} /> : <TerminalNativeBalance amount={holding} />}
        </StatColumn>

        <div className="flex min-w-0 flex-col items-center gap-1 px-2 pr-4">
          <span className={cn(LABEL, 'inline-flex items-center justify-center gap-1')}>
            <span>PnL</span>
            <CurrencyToggle usdMode={usdMode} nativeSym={nativeSym} onToggle={onToggleUsd} />
          </span>
          <span
            className={cn(
              VALUE_PNL,
              pnl >= 0 ? 'text-signal-bull' : 'text-signal-bear',
            )}
          >
            {chainIcon}
            {usdMode ? (
              <TerminalUsdTradePnl pnl={pnl} pct={pnlPct} />
            ) : (
              <TerminalNativeTradePnl pnl={pnl} pct={pnlPct} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
