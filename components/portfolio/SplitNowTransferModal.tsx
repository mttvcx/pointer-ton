'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';

function walletLabel(w: MyWalletRow): string {
  return w.label?.trim() || shortenAddress(w.wallet_address, 4);
}

export function SplitNowTransferModal({
  visible,
  source,
  receivers,
  nativeSym,
  onClose,
  onBack,
}: {
  visible: boolean;
  source: MyWalletRow;
  receivers: MyWalletRow[];
  nativeSym: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const { getAccessToken } = usePointerAuth();
  const available = useMemo(() => {
    const lam = source.balance_lamports;
    if (!lam) return 0;
    try {
      return Number(lam) / 1e9;
    } catch {
      return 0;
    }
  }, [source.balance_lamports]);

  const [pct, setPct] = useState(100);
  const [minSol, setMinSol] = useState(0.06);
  const [busy, setBusy] = useState(false);
  const [deposit, setDeposit] = useState<{
    orderId: string;
    depositAddress: string;
    depositAmount: number;
    exchangerId: string;
  } | null>(null);

  const amount = useMemo(() => (available * pct) / 100, [available, pct]);
  const belowMin = amount > 0 && amount < minSol;
  const receiverLabel =
    receivers.length === 1 ? walletLabel(receivers[0]!) : `${receivers.length} wallets`;

  useEffect(() => {
    if (!visible) return;
    setPct(100);
    setDeposit(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch('/api/splitnow/limits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json()) as { minSol?: number };
        if (typeof j.minSol === 'number' && j.minSol > 0) setMinSol(j.minSol);
      } catch {
        /* keep default */
      }
    })();
  }, [visible, getAccessToken]);

  const onConfirm = useCallback(async () => {
    if (belowMin || amount <= 0) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');
      const res = await fetch('/api/splitnow/order', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fromAmount: amount,
          receivers: receivers.map((r) => r.wallet_address),
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        message?: string;
        orderId?: string;
        depositAddress?: string;
        depositAmount?: number;
        exchangerId?: string;
      };
      if (!res.ok) {
        throw new Error(j.message ?? j.error ?? 'Order failed');
      }
      setDeposit({
        orderId: j.orderId!,
        depositAddress: j.depositAddress!,
        depositAmount: j.depositAmount ?? amount,
        exchangerId: j.exchangerId ?? 'binance',
      });
      toast.success('SplitNOW order created', {
        description: `Send ${formatNumber(j.depositAmount ?? amount, { decimals: 5 })} SOL to fund the transfer.`,
      });
    } catch (e) {
      console.error('[SplitNowTransferModal] order create failed', e);
      toast.error('Couldn’t create the SplitNOW order — please try again');
    } finally {
      setBusy(false);
    }
  }, [amount, belowMin, getAccessToken, receivers]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className={cn('absolute inset-0 bg-black/70', overlayBackdropClasses(true))}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(true),
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-fg-primary">
              SplitNOW Transfer {walletLabel(source)} → {receiverLabel}
            </h2>
          </div>
          <CloseButton onClick={onClose} label="Close" />
        </div>

        {!deposit ? (
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-fg-muted">Total Amount</label>
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border-subtle bg-bg-sunken px-3 py-2">
                  <span className="text-lg font-semibold tabular-nums text-fg-primary">
                    {formatNumber(amount, { decimals: 9 })}
                  </span>
                  <span className="ml-auto text-[11px] font-medium text-fg-muted">{nativeSym}</span>
                </div>
                <div className="flex w-16 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken text-[11px] font-semibold tabular-nums text-fg-secondary">
                  {pct}%
                </div>
              </div>
            </div>

            <div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full accent-accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-fg-muted">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <p className="text-[11px] text-fg-muted">
              Available:{' '}
              <span className="font-semibold tabular-nums text-fg-primary">
                {formatNumber(available, { decimals: 5 })} {nativeSym}
              </span>
            </p>

            {belowMin ? (
              <div className="rounded-lg border border-signal-bear/30 bg-signal-bear/10 px-3 py-2 text-[11px] text-signal-bear">
                Amount is below the minimum required. Minimum is {formatNumber(minSol, { decimals: 2 })} {nativeSym}.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 p-4 text-[11px]">
            <p className="text-fg-secondary">
              Order <span className="font-mono text-fg-primary">{deposit.orderId}</span> created via{' '}
              <span className="capitalize text-accent-primary">{deposit.exchangerId}</span>.
            </p>
            <p className="text-fg-muted">
              Send exactly{' '}
              <span className="font-semibold tabular-nums text-fg-primary">
                {formatNumber(deposit.depositAmount, { decimals: 6 })} {nativeSym}
              </span>{' '}
              from <span className="font-semibold">{walletLabel(source)}</span> to:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-fg-primary">
                {deposit.depositAddress}
              </code>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-fg-muted hover:text-fg-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(deposit.depositAddress);
                  toast.success('Deposit address copied');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-fg-muted">
              SplitNOW will route funds to {receivers.length} receiver{receivers.length === 1 ? '' : 's'} once the
              deposit confirms.
            </p>
          </div>
        )}

        <div className="flex gap-2 border-t border-border-subtle p-4">
          <button
            type="button"
            onClick={deposit ? onClose : onBack}
            className="rounded-full border border-border-subtle px-4 py-2 text-[11px] font-semibold text-fg-secondary hover:bg-bg-hover"
          >
            {deposit ? 'Done' : 'Back'}
          </button>
          {!deposit ? (
            <button
              type="button"
              disabled={busy || belowMin || amount <= 0}
              onClick={() => void onConfirm()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent-primary py-2 text-[11px] font-bold text-fg-inverse disabled:opacity-45"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Order {formatNumber(amount, { decimals: 3 })} {nativeSym}
            </button>
          ) : null}
        </div>

        <div className="flex justify-center gap-1.5 pb-3">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 w-1.5 rounded-full', i === (deposit ? 2 : 1) ? 'bg-accent-primary' : 'bg-white/15')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
