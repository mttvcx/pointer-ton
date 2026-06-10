'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/shared/CopyButton';
import { DepositAssetIcon } from '@/components/wallet/DepositAssetIcon';
import { depositChainIconSrc } from '@/lib/wallet/depositAssetIcons';
import { fundingForChain } from '@/lib/onramper/chainFundingConfig';
import { ONRAMPER_MIN_USD } from '@/lib/onramper/constants';
import {
  onramperSignatureErrorSchema,
  onramperSignatureResponseSchema,
} from '@/lib/onramper/schemas';
import { nativeTicker, nativeUsdTickerSymbol } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { formatUsd } from '@/lib/utils/formatters';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { EX } from '@/components/wallet/exchangeModalUi';

function filterDecimalTyped(raw: string, maxFractionDigits: number): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, maxFractionDigits)}`;
}

type TickerRow = {
  symbol: string;
  usdPrice: number | null;
};

export function BuyPanel({
  walletAddress,
  nativeBalance = null,
  solUsd = null,
}: {
  walletAddress: string | null;
  nativeBalance?: number | null;
  solUsd?: number | null;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const chainLabel = fundingForChain(activeChain).pickerLabel;
  const priceSymbol = nativeUsdTickerSymbol(activeChain);

  const [amountIn, setAmountIn] = useState('');
  const [launching, setLaunching] = useState(false);

  const tickerQ = useQuery({
    queryKey: ['buy-native-price', activeChain, priceSymbol],
    queryFn: async (): Promise<number | null> => {
      const res = await fetch('/api/prices/tickers');
      if (!res.ok) return null;
      const json: unknown = await res.json();
      const tickers =
        json && typeof json === 'object' && 'tickers' in json
          ? (json as { tickers: TickerRow[] }).tickers
          : [];
      if (!Array.isArray(tickers)) return null;
      const row = tickers.find((t) => t.symbol === priceSymbol);
      return row?.usdPrice != null && Number.isFinite(row.usdPrice) ? row.usdPrice : null;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const nativeUsd = tickerQ.data ?? (activeChain === 'sol' ? solUsd : null);

  const amountNative = Number(amountIn);
  const amountValid = Number.isFinite(amountNative) && amountNative > 0;
  const usdAmount = useMemo(() => {
    if (!amountValid || nativeUsd == null) return null;
    return amountNative * nativeUsd;
  }, [amountNative, amountValid, nativeUsd]);

  const meetsMin = usdAmount != null && usdAmount >= ONRAMPER_MIN_USD;

  const buyDisabled =
    !walletAddress ||
    !amountValid ||
    nativeUsd == null ||
    !meetsMin ||
    launching;

  async function handleBuy() {
    if (!walletAddress || usdAmount == null || !meetsMin) return;

    setLaunching(true);
    const toastId = toast.loading('Generating signature…');

    try {
      const res = await fetch('/api/onramper/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeChain,
          walletAddress,
          fiatAmount: Math.round(usdAmount * 100) / 100,
          defaultFiat: 'USD',
        }),
      });

      const json: unknown = await res.json();

      if (!res.ok) {
        const err = onramperSignatureErrorSchema.safeParse(json);
        const message = err.success ? err.data.error : 'Could not start Onramper';
        if (err.success && err.data.code === 'ONRAMPER_NOT_CONFIGURED') {
          toast.error('Onramper is not configured yet', {
            id: toastId,
            description: 'Set ONRAMPER_API_KEY and ONRAMPER_SIGNING_SECRET in env.',
          });
          return;
        }
        throw new Error(message);
      }

      const parsed = onramperSignatureResponseSchema.parse(json);
      toast.success('Opening Onramper', { id: toastId });
      window.open(parsed.widgetUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Buy failed', { id: toastId });
    } finally {
      setLaunching(false);
    }
  }

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className={cn('max-w-xs leading-relaxed', EX.muted)}>
          Connect or create a{' '}
          <span className="font-semibold text-fg-primary">{nativeSym}</span> wallet to buy crypto with
          card or bank transfer.
        </p>
        <Link href="/wallets" className={cn(EX.cta, 'w-auto px-5')}>
          Open Wallets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2', EX.inset)}>
        <span className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-fg-primary">
          <DepositAssetIcon
            src={depositChainIconSrc(activeChain)}
            label={nativeSym}
            size="md"
            className="h-5 w-5"
          />
          <span className="truncate">{chainLabel}</span>
        </span>
        <span className="shrink-0 tabular-nums text-[11px] text-fg-muted">
          <TerminalNativeBalance amount={nativeBalance ?? 0} className="inline text-fg-primary" />{' '}
          {nativeSym}
        </span>
      </div>

      <div className={cn('p-3', EX.inset)}>
        <div className={cn('flex items-center justify-between gap-2', EX.label, 'normal-case tracking-normal')}>
          <span className="font-semibold uppercase tracking-wide">Buying</span>
          {nativeUsd != null ? (
            <span className="tabular-nums">
              {nativeSym} Price:{' '}
              <span className="font-semibold text-fg-primary">{nativeUsd.toFixed(2)}</span>
            </span>
          ) : (
            <span>{tickerQ.isFetching ? 'Loading price…' : 'Price unavailable'}</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input
            value={amountIn}
            onChange={(e) => setAmountIn(filterDecimalTyped(e.target.value, 6))}
            placeholder="0.0"
            inputMode="decimal"
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/60"
          />
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-fg-primary', EX.control)}>
            <DepositAssetIcon
              src={depositChainIconSrc(activeChain)}
              label={nativeSym}
              size="sm"
              className="h-4 w-4"
            />
            {nativeSym}
          </span>
        </div>

        <div className={cn('mt-2 flex items-center justify-between gap-2 text-[10px]', EX.muted)}>
          <span>Minimum {ONRAMPER_MIN_USD} USD</span>
          {usdAmount != null ? (
            <span className="tabular-nums">
              ≈{' '}
              <span
                className={cn(
                  'font-semibold',
                  meetsMin ? 'text-fg-primary' : 'text-amber-400/90',
                )}
              >
                {formatUsd(usdAmount, { decimals: 1 })}
              </span>
            </span>
          ) : (
            <span className="tabular-nums text-fg-muted/60">≈ —</span>
          )}
        </div>

        <p className={cn('mt-3 text-center text-[9px] font-medium uppercase tracking-[0.14em]', EX.muted)}>
          powered by <span className="text-fg-secondary">onramper</span>
        </p>
      </div>

      <button
        type="button"
        disabled={buyDisabled}
        onClick={() => void handleBuy()}
        className={cn(
          EX.cta,
          'flex items-center justify-center gap-2',
          buyDisabled && 'cursor-not-allowed bg-bg-hover text-fg-muted shadow-none hover:brightness-100',
        )}
      >
        {launching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Buy
      </button>

      <div className={cn('px-3 py-2.5', EX.inset)}>
        <div className="flex items-center justify-between gap-2">
          <span className={EX.label}>Your wallet address</span>
          <CopyButton
            value={walletAddress}
            toastLabel="Address copied"
            label="Copy address"
            iconOnly
            iconClassName="h-7 w-7 rounded-md border border-border-subtle/60 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          />
        </div>
        <p className="mt-1.5 break-all font-mono text-[11px] leading-snug tabular-nums text-fg-primary">
          {walletAddress}
        </p>
      </div>
    </div>
  );
}
