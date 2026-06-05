'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown, Clock, X } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import {
  DEPOSIT_ACCEPTING_SYMBOLS,
  ONRAMPER_HREF,
} from '@/components/wallet/walletFundingConstants';
import { BuyPanel } from '@/components/wallet/BuyPanel';
import { ConvertPanel } from '@/components/wallet/ConvertPanel';
import { DepositAssetIcon } from '@/components/wallet/DepositAssetIcon';
import { WithdrawSendPanel } from '@/components/wallet/WithdrawSendPanel';
import { depositChainIconSrc, depositTokenIconSrc } from '@/lib/wallet/depositAssetIcons';

const QRCodeSVG = dynamic(() => import('react-qr-code').then((m) => m.default), { ssr: false });

const DEPOSIT_NETWORK_ROWS: { chain: AppChainId; label: string }[] = [
  { chain: 'ton', label: 'TON' },
  { chain: 'sol', label: 'Solana' },
  { chain: 'bnb', label: 'BNB Chain' },
  { chain: 'base', label: 'Base' },
];

export type ExchangeTab = 'convert' | 'deposit' | 'withdraw' | 'buy';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: ExchangeTab;
  walletAddress: string | null;
  nativeBalance?: number | null;
  usdcBalance?: number | null;
  solUsd?: number | null;
  onOpenDepositHistory: () => void;
};

export function ExchangeModal({
  open,
  onOpenChange,
  initialTab = 'deposit',
  walletAddress,
  nativeBalance = null,
  usdcBalance = null,
  solUsd = null,
  onOpenDepositHistory,
}: Props) {
  const [tab, setTab] = useState<ExchangeTab>(initialTab);
  const [assetOpen, setAssetOpen] = useState(false);
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);
  const nativeSym = nativeTicker(activeChain);
  const depositNetworkLabel =
    DEPOSIT_NETWORK_ROWS.find((r) => r.chain === activeChain)?.label ?? nativeSym;

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setTab(initialTab));
    return () => cancelAnimationFrame(raf);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const copyAddr = () => {
    if (!walletAddress) return;
    void navigator.clipboard.writeText(walletAddress).then(
      () => toastCopied(walletAddress),
      () => toastCopyFailed('Could not copy'),
    );
  };

  if (!open) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        data-modal-panel
        className={cn(
          'relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-sm border border-[#2e2e32] bg-[#141414]',
          'font-sans shadow-2xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#2e2e32] px-3 py-2.5">
          <h2 id="exchange-title" className="text-[15px] font-semibold text-white">
            Exchange
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-[#9ca3af] transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="shrink-0 p-2">
          <div className="flex rounded-lg border border-[#1b1f2a] bg-[#12141b] p-0.5">
            {(['convert', 'deposit', 'withdraw', 'buy'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-[11px] font-semibold capitalize transition',
                  tab === id
                    ? 'bg-[#2d3343] text-white shadow-sm'
                    : 'text-[#6b7280] hover:text-[#d1d5db]',
                )}
              >
                {id === 'deposit'
                  ? 'Deposit'
                  : id === 'withdraw'
                    ? 'Withdraw'
                    : id === 'convert'
                      ? 'Convert'
                      : 'Buy'}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {tab === 'convert' ? (
            <ConvertPanel
              walletAddress={walletAddress}
              nativeBalance={nativeBalance}
              usdcBalance={usdcBalance}
              solUsd={solUsd}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
          {tab === 'withdraw' ? (
            <WithdrawSendPanel
              activeChain={activeChain}
              walletAddress={walletAddress}
              nativeBalance={nativeBalance}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
          {tab === 'buy' ? (
            <BuyPanel
              walletAddress={walletAddress}
              nativeBalance={nativeBalance}
              solUsd={solUsd}
            />
          ) : null}
          {tab === 'deposit' && walletAddress ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setAssetOpen((o) => !o)}
                    className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 text-left text-[12px] text-white transition hover:border-[#2d3548]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <DepositAssetIcon
                        src={depositChainIconSrc(activeChain)}
                        label={nativeSym}
                        size="lg"
                        className="h-6 w-6"
                      />
                      <span className="truncate font-semibold">{depositNetworkLabel}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-[#6b7280] transition',
                        assetOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {assetOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-48 overflow-auto rounded-lg border border-[#1b1f2a] bg-[#12141b] py-1 shadow-xl">
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#4b5563]">
                        Networks
                      </div>
                      {DEPOSIT_NETWORK_ROWS.map((row) => {
                        const selected = row.chain === activeChain;
                        return (
                          <button
                            key={row.chain}
                            type="button"
                            onClick={() => {
                              setActiveChain(row.chain);
                              setAssetOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition',
                              selected
                                ? 'bg-white/[0.06] text-white'
                                : 'text-[#d1d5db] hover:bg-white/5 hover:text-white',
                            )}
                          >
                            <DepositAssetIcon
                              src={depositChainIconSrc(row.chain)}
                              label={row.label}
                              size="md"
                            />
                            <span className="min-w-0 flex-1 truncate">{row.label}</span>
                            {selected ? (
                              <span className="shrink-0 text-[9px] font-semibold text-[#5865F2]">Selected</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onOpenDepositHistory}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 text-[11px] font-semibold text-[#9ca3af] transition hover:border-[#2d3548] hover:text-white"
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  Deposit History
                </button>
              </div>

              <p className="text-[11px] leading-snug text-[#6b7280]">
                {activeChain === 'ton'
                  ? 'Deposit TON or jettons directly to your wallet address.'
                  : `Send ${nativeSym} and compatible tokens to your deposit address below.`}
              </p>

              <div className="flex gap-3 rounded-lg border border-[#1b1f2a] bg-[#12141b] p-3">
                <div className="relative flex shrink-0 items-center justify-center rounded-md bg-white p-2">
                  <div className="h-[100px] w-[100px]">
                    <QRCodeSVG
                      value={walletAddress}
                      size={100}
                      fgColor="#0b0d12"
                      bgColor="#ffffff"
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                  <span className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-[#141414] shadow ring-1 ring-black/20">
                    <DepositAssetIcon
                      src={depositChainIconSrc(activeChain)}
                      label={nativeSym}
                      size="lg"
                      className="h-5 w-5"
                    />
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      {nativeSym} deposit address
                    </div>
                    <div className="mt-1 break-all tabular-nums text-[12px] leading-snug text-white">
                      {walletAddress}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <CopyButton
                      value={walletAddress}
                      toastLabel="Address copied"
                      label="Copy address"
                      iconOnly
                      iconClassName="h-8 w-8 rounded-md border border-[#2d3548] text-[#9ca3af] hover:bg-white/5 hover:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Accepting
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {DEPOSIT_ACCEPTING_SYMBOLS.map((sym) => {
                    const iconSrc = depositTokenIconSrc(sym);
                    return (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-[#2e2e32] bg-[#12141b] px-2 py-0.5 text-[10px] font-semibold text-white"
                      >
                        {iconSrc ? (
                          <DepositAssetIcon src={iconSrc} label={sym} size="md" className="h-4 w-4" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full bg-[#2d3343]" aria-hidden />
                        )}
                        {sym}
                      </span>
                    );
                  })}
                </div>
              </div>

              <p className="text-center text-[11px] text-[#6b7280]">
                Don&apos;t have {nativeSym}?{' '}
                <a
                  href={ONRAMPER_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#5865F2] hover:underline"
                >
                  Buy through Onramper.
                </a>
              </p>
            </div>
          ) : tab === 'deposit' && !walletAddress ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="max-w-xs text-[12px] leading-relaxed text-[#9ca3af]">
                You don&apos;t have an active{' '}
                <span className="font-semibold text-white">{nativeSym}</span> wallet for this chain yet.
                Create or import one to get a deposit QR and address.
              </p>
              <Link
                href="/wallets"
                onClick={() => onOpenChange(false)}
                className="btn-press inline-flex rounded-full bg-[#5865F2] px-4 py-2 text-[12px] font-semibold text-[#0a0a0f] transition hover:brightness-105"
              >
                Open Wallets
              </Link>
              <a
                href={ONRAMPER_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-[#5865F2] hover:underline"
              >
                Buy crypto via Onramper
              </a>
            </div>
          ) : null}
        </div>

        {tab === 'deposit' && walletAddress ? (
          <div className="shrink-0 border-t border-[#1b1f2a] p-3">
            <button
              type="button"
              onClick={copyAddr}
              className="btn-press focus-ring w-full rounded-full bg-[#5865F2] py-2.5 text-[13px] font-semibold text-[#0a0a0f] transition hover:brightness-105"
            >
              Copy Address
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
