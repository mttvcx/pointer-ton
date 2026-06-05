'use client';

import { useMemo, useState } from 'react';
import { CircleDollarSign, Wallet } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { syntheticTokenExtendedMetrics } from '@/lib/dev/demoTokenFixtures';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { pickTokenTradePerfChanges } from '@/lib/tokens/tokenTradePerfTfs';
import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';
import { TokenTradeDeskStrip } from '@/components/tokens/TokenTradeDeskStrip';
import { PerpsExchangeModal } from '@/components/perps/PerpsExchangeModal';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';
import { toast } from 'sonner';

const EXEC_MSG = 'Stock execution coming soon';

function stockDeskMint(symbol: string): string {
  return `stock-desk-${symbol}`;
}

function TradeAmountInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
}) {
  return (
    <div className="relative flex min-h-[2.35rem] items-center gap-2 rounded-md border border-border-subtle bg-bg-hover/40 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-accent-primary/55 focus-within:ring-accent-primary/20">
      <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label="Trade size"
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring min-w-0 flex-1 border-0 bg-transparent py-0.5 text-right font-sans text-sm font-medium tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/80 placeholder:italic"
      />
      <span className="pointer-events-none shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        {suffix}
      </span>
    </div>
  );
}

export function StockOrderPanel({ market }: { market: SyntheticStockMarket }) {
  const { authenticated, login } = usePointerAuth();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [mode, setMode] = useState<'market' | 'limit'>('market');
  const [sizePct, setSizePct] = useState(0);
  const [leverage, setLeverage] = useState(5);
  const [tpSl, setTpSl] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [amountUsdc, setAmountUsdc] = useState('');
  const [perfTf, setPerfTf] = useState<TokenTradePerfTf>('24h');

  const mint = stockDeskMint(market.symbol);
  const deskMetrics = useMemo(() => syntheticTokenExtendedMetrics(mint), [mint]);
  const perfChanges = useMemo(() => pickTokenTradePerfChanges(null, mint), [mint]);

  const isLong = side === 'long';
  const availableMargin = 0;
  const needsFunds = authenticated && availableMargin <= 0;

  function onPrimaryAction() {
    if (!authenticated) {
      void login();
      return;
    }
    toast.message(EXEC_MSG);
  }

  return (
    <>
      <div className="relative flex w-full min-w-0 flex-col bg-bg-raised text-[12px] text-fg-primary">
        <div className="space-y-3 px-3 pb-5 pt-2 lg:px-3 lg:pb-4">
          <TokenTradeDeskStrip
            metrics={deskMetrics}
            mint={mint}
            changes={perfChanges}
            selected={perfTf}
            onSelect={setPerfTf}
          />

          <div className="flex w-full rounded-lg bg-bg-hover/50 p-1">
            <button
              type="button"
              aria-pressed={isLong}
              onClick={() => setSide('long')}
              className={cn(
                'btn-press focus-ring flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-semibold',
                'transition-[background-color,color,box-shadow,filter] duration-200 ease-out',
                isLong
                  ? 'cta-bull'
                  : 'bg-transparent text-fg-muted hover:bg-signal-bull/10 hover:text-signal-bull',
              )}
            >
              Long
            </button>
            <button
              type="button"
              aria-pressed={!isLong}
              onClick={() => setSide('short')}
              className={cn(
                'btn-press focus-ring flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-semibold',
                'transition-[background-color,color,box-shadow,filter] duration-200 ease-out',
                !isLong
                  ? 'cta-bear'
                  : 'bg-transparent text-fg-muted hover:bg-signal-bear/10 hover:text-signal-bear',
              )}
            >
              Short
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-1 border-b border-border-subtle/40 pb-0 pt-0.5">
            {(['market', 'limit'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-2.5 pb-2 pt-1 text-[12px] font-semibold capitalize transition-colors duration-150',
                  'border-b-2',
                  mode === m
                    ? 'border-fg-primary text-fg-primary'
                    : 'border-transparent text-fg-muted hover:text-fg-secondary',
                )}
              >
                {m}
              </button>
            ))}
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setExchangeOpen(true)}
                className="flex items-center gap-1 rounded-full border border-border-subtle bg-bg-raised px-2 py-1 text-[10px] text-fg-secondary hover:bg-white/[0.04] hover:text-fg-primary"
                aria-label="Deposit margin"
              >
                <Wallet className="h-3 w-3" />
                <span className="tabular-nums">{formatNumber(availableMargin, { decimals: 2 })}</span>
                <span className="text-fg-muted">USDC</span>
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border-subtle bg-bg-raised p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-fg-secondary">
              <span>Size</span>
              <span className="tabular-nums">
                {market.symbol} <span className="text-fg-primary">0</span>
              </span>
            </div>
            <TradeAmountInput
              value={amountUsdc}
              onChange={setAmountUsdc}
              placeholder="0.0"
              suffix="USDC"
            />
            <div className="mt-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={sizePct}
                onChange={(e) => setSizePct(Number.parseInt(e.target.value, 10))}
                className="h-1.5 w-full cursor-pointer accent-accent-primary"
                aria-label="Size percentage"
              />
              <div className="mt-1 flex justify-between text-[9px] tabular-nums text-fg-muted">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border-subtle bg-bg-raised p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-medium text-fg-muted">Leverage</span>
              <span className="text-[11px] font-semibold tabular-nums text-fg-secondary">{leverage}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={leverage}
              onChange={(e) => setLeverage(Number.parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-accent-primary"
              aria-label="Leverage"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <label className="flex cursor-pointer items-center gap-2 text-fg-secondary">
              <input
                type="checkbox"
                checked={tpSl}
                onChange={(e) => setTpSl(e.target.checked)}
                className="rounded border-border-subtle accent-accent-primary"
              />
              TP/SL
            </label>
            <span className="tabular-nums text-fg-muted">
              Est. Liq. Price: <span className="text-fg-secondary">—</span>
            </span>
          </div>

          <div className="pt-0.5">
            <button
              type="button"
              onClick={onPrimaryAction}
              className={cn(
                'btn-press focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
                isLong ? 'cta-bull' : 'cta-bear',
              )}
            >
              {!authenticated
                ? 'Connect wallet to trade'
                : needsFunds
                  ? 'Add More Funds'
                  : `${isLong ? 'Long' : 'Short'} ${market.symbol}`}
            </button>
          </div>

          <div className="space-y-1.5 border-t border-border-subtle/80 pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Available Margin</span>
              <button
                type="button"
                onClick={() => setExchangeOpen(true)}
                className="font-semibold tabular-nums text-accent-glow hover:underline"
              >
                {formatNumber(availableMargin, { decimals: 2 })} USDC
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Account Value</span>
              <span className="font-semibold tabular-nums text-fg-secondary">0.00 USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Current Position</span>
              <span className="font-semibold tabular-nums text-fg-secondary">—</span>
            </div>
          </div>
        </div>
      </div>

      <PerpsExchangeModal open={exchangeOpen} onClose={() => setExchangeOpen(false)} />
    </>
  );
}
