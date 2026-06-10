'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown, Clock, X } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import {
  DEPOSIT_ACCEPTING_SYMBOLS,
  ONRAMPER_HREF,
} from '@/components/wallet/walletFundingConstants';
import { EX } from '@/components/wallet/exchangeModalUi';
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

const TABS = [
  ['convert', 'Convert'],
  ['deposit', 'Deposit'],
  ['withdraw', 'Withdraw'],
  ['buy', 'Buy'],
] as const;

export type ExchangeTab = (typeof TABS)[number][0];

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
    <div className={cn('fixed inset-0 flex items-end justify-center sm:items-center sm:p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/90 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        data-modal-panel
        className={cn(EX.shell, overlayPanelClasses(true))}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={EX.header}>
          <h2 id="exchange-title" className={EX.title}>
            Fund wallet
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-press focus-ring rounded-md p-1 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className={EX.tabBar} role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={EX.tab(tab === id)}
            >
              {label}
              {tab === id ? <span className={EX.tabIndicator} aria-hidden /> : null}
            </button>
          ))}
        </div>

        <div className={EX.body}>
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
            <BuyPanel walletAddress={walletAddress} nativeBalance={nativeBalance} solUsd={solUsd} />
          ) : null}
          {tab === 'deposit' && walletAddress ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setAssetOpen((o) => !o)}
                    className={cn(EX.control, 'h-9 w-full justify-between text-fg-primary')}
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
                        'h-4 w-4 shrink-0 text-fg-muted transition',
                        assetOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {assetOpen ? (
                    <div
                      className={cn(
                        'absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-48 overflow-auto py-1 shadow-panel',
                        EX.inset,
                        'bg-bg-raised',
                      )}
                    >
                      <div className={cn('px-2.5 py-1.5', EX.label)}>Networks</div>
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
                              'flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] transition',
                              selected
                                ? 'bg-bg-hover text-fg-primary'
                                : 'text-fg-secondary hover:bg-bg-hover/70 hover:text-fg-primary',
                            )}
                          >
                            <DepositAssetIcon
                              src={depositChainIconSrc(row.chain)}
                              label={row.label}
                              size="md"
                            />
                            <span className="min-w-0 flex-1 truncate">{row.label}</span>
                            {selected ? (
                              <span className="shrink-0 text-[9px] font-semibold text-accent-glow">
                                Active
                              </span>
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
                  className={cn(EX.control, 'shrink-0 font-semibold text-fg-secondary hover:text-fg-primary')}
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  History
                </button>
              </div>

              <p className={EX.muted}>
                {activeChain === 'ton'
                  ? 'Deposit TON or jettons directly to your wallet address.'
                  : `Send ${nativeSym} and compatible tokens to your deposit address below.`}
              </p>

              <div className={cn('flex gap-3 p-3', EX.inset)}>
                <div className="relative flex shrink-0 items-center justify-center rounded-md bg-white p-2">
                  <div className="h-[100px] w-[100px]">
                    <QRCodeSVG
                      value={walletAddress}
                      size={100}
                      fgColor="#080D14"
                      bgColor="#ffffff"
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                  <span className="absolute flex h-7 w-7 items-center justify-center rounded-md bg-bg-base shadow ring-1 ring-border-subtle/40">
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
                    <div className={EX.label}>{nativeSym} deposit address</div>
                    <div className="mt-1 break-all font-mono text-[12px] leading-snug text-fg-primary">
                      {walletAddress}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <CopyButton
                      value={walletAddress}
                      toastLabel="Address copied"
                      label="Copy address"
                      iconOnly
                      iconClassName="h-8 w-8 rounded-md border border-border-subtle/60 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className={EX.label}>Accepting</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {DEPOSIT_ACCEPTING_SYMBOLS.map((sym) => {
                    const iconSrc = depositTokenIconSrc(sym);
                    return (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle/50 bg-bg-sunken/30 px-2 py-0.5 text-[10px] font-semibold text-fg-secondary"
                      >
                        {iconSrc ? (
                          <DepositAssetIcon src={iconSrc} label={sym} size="md" className="h-4 w-4" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-md bg-bg-hover" aria-hidden />
                        )}
                        {sym}
                      </span>
                    );
                  })}
                </div>
              </div>

              <p className={cn('text-center', EX.muted)}>
                Don&apos;t have {nativeSym}?{' '}
                <a href={ONRAMPER_HREF} target="_blank" rel="noopener noreferrer" className={EX.link}>
                  Buy through Onramper
                </a>
              </p>
            </div>
          ) : tab === 'deposit' && !walletAddress ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className={cn('max-w-xs leading-relaxed', EX.muted)}>
                You don&apos;t have an active{' '}
                <span className="font-semibold text-fg-primary">{nativeSym}</span> wallet on this chain
                yet. Create or import one to get a deposit QR and address.
              </p>
              <Link href="/wallets" onClick={() => onOpenChange(false)} className={cn(EX.cta, 'w-auto px-5')}>
                Open Wallets
              </Link>
              <a href={ONRAMPER_HREF} target="_blank" rel="noopener noreferrer" className={EX.link}>
                Buy crypto via Onramper
              </a>
            </div>
          ) : null}
        </div>

        {tab === 'deposit' && walletAddress ? (
          <div className={EX.footer}>
            <button type="button" onClick={copyAddr} className={EX.cta}>
              Copy address
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
