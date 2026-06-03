'use client';

import { useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { PerpsExchangeModal } from '@/components/perps/PerpsExchangeModal';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

const EXEC_MSG = 'Stock execution coming soon';

export function StockOrderPanel({ market }: { market: SyntheticStockMarket }) {
  const { authenticated, login } = usePointerAuth();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [mode, setMode] = useState<'market' | 'limit'>('market');
  const [sizePct, setSizePct] = useState(0);
  const [leverage, setLeverage] = useState(5);
  const [tpSl, setTpSl] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [amountUsdc, setAmountUsdc] = useState('');

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
      <div className="flex min-h-0 flex-col overflow-y-auto bg-bg-raised xl:overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-2.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Trade</span>
          <button
            type="button"
            onClick={() => setExchangeOpen(true)}
            className="rounded-md bg-accent-primary px-3 py-1 text-[11px] font-semibold text-fg-inverse hover:brightness-110"
          >
            Deposit
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1.5">
          <button
            type="button"
            onClick={() => setSide('long')}
            className={cn(
              'rounded-md py-2.5 text-[13px] font-semibold transition-colors',
              isLong ? 'bg-signal-bull text-[#03100b]' : 'bg-bg-sunken text-fg-muted hover:text-fg-secondary',
            )}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setSide('short')}
            className={cn(
              'rounded-md py-2.5 text-[13px] font-semibold transition-colors',
              !isLong ? 'bg-signal-bear text-white' : 'bg-bg-sunken text-fg-muted hover:text-fg-secondary',
            )}
          >
            Short
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-border-subtle px-2 pb-2">
          {(['market', 'limit'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                mode === m ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {m}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-semibold tabular-nums text-fg-secondary">
            Leverage: {leverage}x
          </span>
        </div>

        <div className="space-y-3 p-2.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-fg-muted">Size</span>
              <span className="text-[10px] tabular-nums text-fg-muted">
                {market.symbol} <span className="text-fg-secondary">0</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken/60 px-3 py-2">
              <input
                value={amountUsdc}
                onChange={(e) => setAmountUsdc(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/50"
              />
              <span className="text-[12px] font-semibold text-fg-secondary">USDC</span>
            </div>
          </div>

          <div>
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
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

          <button
            type="button"
            onClick={onPrimaryAction}
            className={cn(
              'w-full rounded-lg py-3 text-[14px] font-semibold transition active:scale-[0.99]',
              isLong ? 'bg-signal-bull text-[#03100b] hover:brightness-105' : 'bg-signal-bear text-white hover:brightness-105',
            )}
          >
            {!authenticated
              ? 'Connect wallet to trade'
              : needsFunds
                ? 'Add More Funds'
                : `${isLong ? 'Long' : 'Short'} ${market.symbol}`}
          </button>

          <div className="space-y-1.5 border-t border-border-subtle/80 pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Available Margin</span>
              <button
                type="button"
                onClick={() => setExchangeOpen(true)}
                className="font-semibold tabular-nums text-accent-glow hover:underline"
              >
                {availableMargin.toFixed(2)} USDC
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
