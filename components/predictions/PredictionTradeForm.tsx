'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PredictionMarket } from '@/lib/predictions/types';
import { useKalshiOrderConfigured } from '@/lib/hooks/usePredictionMarkets';
import { formatUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

const AMOUNT_PRESETS = [1, 10, 25, 100] as const;

export function PredictionTradeForm({
  market,
  initialOutcome = 'yes',
  showStats = true,
}: {
  market: PredictionMarket;
  initialOutcome?: 'yes' | 'no';
  showStats?: boolean;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<'yes' | 'no'>(initialOutcome);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configuredQ = useKalshiOrderConfigured();
  const canTrade = configuredQ.data === true;

  useEffect(() => {
    setOutcome(initialOutcome);
  }, [initialOutcome, market.id]);

  const priceCents = outcome === 'yes' ? market.yesPriceCents : market.noPriceCents;
  const amountNum = Number.parseFloat(amount) || 0;
  const shares = priceCents > 0 ? amountNum / (priceCents / 100) : 0;
  const contractCount = Math.max(1, Math.floor(shares));
  const toWin = side === 'buy' ? shares * (1 - priceCents / 100) : amountNum;

  const stats = useMemo(
    () => ({
      boughtUsd: 0,
      soldUsd: 0,
      holdingUsd: 0,
      pnlUsd: 0,
      pnlPct: 0,
    }),
    [],
  );

  async function submitOrder() {
    setError(null);
    setMessage(null);
    if (!canTrade) {
      setError('Kalshi trading keys not configured on server.');
      return;
    }
    if (amountNum <= 0) {
      setError('Enter an amount.');
      return;
    }

    setSubmitting(true);
    try {
      const ticker = market.ticker ?? market.id;
      const body = {
        ticker,
        side: outcome,
        action: side,
        count: contractCount,
        type: 'limit' as const,
        ...(outcome === 'yes'
          ? { yes_price: Math.min(99, Math.max(1, Math.round(priceCents))) }
          : { no_price: Math.min(99, Math.max(1, Math.round(priceCents))) }),
      };
      const res = await fetch('/api/predictions/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? 'order_failed');
      }
      setMessage(`Order submitted · ${contractCount} ${outcome.toUpperCase()} @ ${priceCents}¢`);
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'order_failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex border-b border-border-subtle/50">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              'flex-1 py-2.5 text-[12px] font-semibold capitalize transition',
              side === s
                ? s === 'buy'
                  ? 'bg-signal-bull/10 text-signal-bull'
                  : 'bg-signal-bear/10 text-signal-bear'
                : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-3">
        <div>
          <p className="mb-2 line-clamp-2 text-[12px] font-medium text-fg-primary">{market.title}</p>
          {market.outcomeLabel ? (
            <p className="mb-2 text-[11px] font-medium text-fg-secondary">{market.outcomeLabel}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOutcome('yes')}
              className={cn(
                'rounded-md py-2.5 text-[12px] font-semibold tabular-nums transition ring-1',
                'bg-signal-bull/18 text-signal-bull ring-signal-bull/30 hover:bg-signal-bull/28',
                outcome === 'yes' && 'ring-2 ring-signal-bull/50',
              )}
            >
              Yes {market.yesPriceCents}¢
            </button>
            <button
              type="button"
              onClick={() => setOutcome('no')}
              className={cn(
                'rounded-md py-2.5 text-[12px] font-semibold tabular-nums transition ring-1',
                'bg-signal-bear/16 text-signal-bear ring-signal-bear/28 hover:bg-signal-bear/24',
                outcome === 'no' && 'ring-2 ring-signal-bear/45',
              )}
            >
              No {market.noPriceCents}¢
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
            Amount
          </label>
          <div className="flex items-center rounded-md border border-border-subtle bg-bg-hover/40 px-2.5 py-2">
            <span className="text-[11px] text-fg-muted">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/60"
            />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {AMOUNT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className="rounded-sm border border-border-subtle/60 bg-bg-hover/30 py-1 text-[11px] font-medium tabular-nums text-fg-secondary hover:bg-bg-hover"
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border border-border-subtle/50 bg-bg-hover/25 px-2.5 py-2 text-[10px] tabular-nums text-fg-muted">
          <div>
            <p className="uppercase tracking-wide">Total</p>
            <p className="font-mono text-[12px] text-fg-primary">{formatUsd(amountNum, { decimals: 2 })}</p>
          </div>
          <div className="text-center">
            <p className="uppercase tracking-wide">Contracts</p>
            <p className="font-mono text-[12px] text-fg-primary">{contractCount}</p>
          </div>
          <div className="text-right">
            <p className="uppercase tracking-wide">Limit</p>
            <p className="font-mono text-[12px] text-fg-primary">{priceCents}¢</p>
          </div>
        </div>

        <div className="rounded-md border border-signal-bull/20 bg-signal-bull/5 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">To win</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-signal-bull">
            {formatUsd(toWin, { decimals: 2 })}
          </p>
        </div>

        {error ? <p className="text-center text-[11px] text-signal-bear">{error}</p> : null}
        {message ? <p className="text-center text-[11px] text-signal-bull">{message}</p> : null}

        <button
          type="button"
          disabled={submitting || !canTrade}
          onClick={() => void submitOrder()}
          className={cn(
            'w-full rounded-md py-3 text-[13px] font-semibold transition',
            canTrade
              ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
              : 'cursor-not-allowed bg-bg-hover text-fg-muted ring-1 ring-border-subtle/60',
          )}
          title={canTrade ? 'Submit limit order to Kalshi' : 'Set KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY'}
        >
          {submitting
            ? 'Submitting…'
            : canTrade
              ? `${side === 'buy' ? 'Buy' : 'Sell'} ${outcome.toUpperCase()} on Kalshi`
              : 'Kalshi keys required to trade'}
        </button>
      </div>

      {showStats ? (
        <div className="shrink-0 border-t border-border-subtle/50" data-predictions-tour="pnl-strip">
          <div className="grid grid-cols-4 divide-x divide-border-subtle/40 py-3">
            {[
              { label: 'Bought', value: stats.boughtUsd, tone: 'text-signal-bull' },
              { label: 'Sold', value: stats.soldUsd, tone: 'text-signal-bear' },
              { label: 'Holding', value: stats.holdingUsd, tone: 'text-fg-primary' },
              {
                label: 'PnL',
                value: stats.pnlUsd,
                tone: stats.pnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                pct: stats.pnlPct,
              },
            ].map((cell) => (
              <div key={cell.label} className="flex flex-col items-center gap-1 px-1">
                <span className="text-[9px] font-medium uppercase tracking-wide text-fg-muted">
                  {cell.label}
                </span>
                <span className={cn('font-mono text-[12px] font-semibold tabular-nums', cell.tone)}>
                  {formatUsd(cell.value, { decimals: 2 })}
                  {'pct' in cell && cell.pct != null ? (
                    <span className="ml-0.5 text-[10px] font-medium opacity-90">
                      ({cell.pct >= 0 ? '+' : ''}
                      {cell.pct.toFixed(0)}%)
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
