'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, X } from 'lucide-react';
import { useWallets } from '@privy-io/react-auth';
import { CopyButton } from '@/components/shared/CopyButton';
import { DepositAssetIcon } from '@/components/wallet/DepositAssetIcon';
import { EX } from '@/components/wallet/exchangeModalUi';
import { HyperliquidPoweredBy } from '@/components/perps/HyperliquidWordmark';
import { depositTokenIconSrc } from '@/lib/wallet/depositAssetIcons';
import { overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { useCctpFund } from '@/lib/hooks/useCctpFund';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

const QRCodeSVG = dynamic(() => import('react-qr-code').then((m) => m.default), { ssr: false });

type Props = { open: boolean; onClose: () => void };

/**
 * Fund the user's Hyperliquid perps account. HL is an EVM L1, so the deposit
 * address is the user's Privy embedded EVM wallet and the asset is USDC on
 * Arbitrum — converting SOL in the Pointer wallet does NOT land on HL, so this is
 * deliberately the EVM/Arbitrum path. "Get USDC" opens the real wallet exchange.
 */
export function PerpsExchangeModal({ open, onClose }: Props) {
  const { wallets } = useWallets();
  const requestExchange = useUIStore((s) => s.requestExchange);
  const [fundAmt, setFundAmt] = useState('');
  const { fund, state: fundState, error: fundError, burnSig, solanaAddress } = useCctpFund();

  const hlAddress = useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    return (embedded ?? wallets[0])?.address ?? null;
  }, [wallets]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const usdcIcon = depositTokenIconSrc('USDC');

  return (
    <div className={cn('fixed inset-0 flex items-end justify-center sm:items-center sm:p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/90 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(EX.shell, overlayPanelClasses(true))}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perps-fund-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={EX.header}>
          <h2 id="perps-fund-title" className={EX.title}>
            Fund Hyperliquid
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring rounded-md p-1 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className={EX.body}>
          {hlAddress ? (
            <div className="space-y-3">
              <p className={EX.muted}>
                Send <span className="font-semibold text-fg-primary">USDC on Hyperliquid</span> to your
                account address, or bridge it straight from your Solana balance below.
              </p>

              {/* One-tap: bridge USDC from Solana to Hyperliquid via Circle CCTP. */}
              <div className="rounded-md border border-accent-primary/30 bg-accent-primary/[0.06] p-3">
                <div className="flex items-center justify-between">
                  <span className={EX.label}>Fund from Solana</span>
                  <span className="text-[10px] text-fg-muted">via Circle CCTP</span>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-border-subtle/50 bg-bg-sunken/40 px-3 py-2">
                  <input
                    value={fundAmt}
                    onChange={(e) => setFundAmt(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                  <span className="text-[11px] font-semibold text-fg-secondary">USDC</span>
                </div>
                <button
                  type="button"
                  disabled={
                    !hlAddress ||
                    !solanaAddress ||
                    fundState === 'signing' ||
                    fundState === 'bridging' ||
                    !(Number(fundAmt) > 0)
                  }
                  onClick={() => hlAddress && fund(Number(fundAmt), hlAddress)}
                  className={cn(EX.cta, 'mt-2')}
                >
                  {fundState === 'signing'
                    ? 'Confirm in wallet…'
                    : fundState === 'bridging'
                      ? 'Bridging…'
                      : 'Bridge to Hyperliquid'}
                </button>
                {fundState === 'done' && burnSig ? (
                  <p className={cn('mt-2', EX.muted)}>
                    Burn sent. USDC mints to your Hyperliquid address after Circle attestation (~1–2
                    min); move it to perps margin in the Hyperliquid app.
                  </p>
                ) : null}
                {fundState === 'error' && fundError ? (
                  <p className="mt-2 text-[11px] text-signal-bear">{fundError}</p>
                ) : null}
              </div>

              <div className={cn('flex gap-3 p-3', EX.inset)}>
                <div className="relative flex shrink-0 items-center justify-center rounded-md bg-white p-2">
                  <div className="h-[100px] w-[100px]">
                    <QRCodeSVG
                      value={hlAddress}
                      size={100}
                      fgColor="#080D14"
                      bgColor="#ffffff"
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                  {usdcIcon ? (
                    <span className="absolute flex h-7 w-7 items-center justify-center rounded-md bg-bg-base shadow ring-1 ring-border-subtle/40">
                      <span className="relative h-5 w-5">
                        <DepositAssetIcon src={usdcIcon} label="USDC" size="lg" className="h-5 w-5" />
                        <img
                          src="/branding/hyperliquid.png"
                          alt=""
                          aria-hidden
                          className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full object-contain ring-1 ring-bg-base"
                        />
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                  <div>
                    <div className={EX.label}>Your Hyperliquid address</div>
                    <div className="mt-1 break-all font-mono text-[12px] leading-snug text-fg-primary">
                      {hlAddress}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <CopyButton
                      value={hlAddress}
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
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle/50 bg-bg-sunken/30 px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                    {usdcIcon ? (
                      <span className="relative h-4 w-4">
                        <DepositAssetIcon src={usdcIcon} label="USDC" size="md" className="h-4 w-4" />
                        <img
                          src="/branding/hyperliquid.png"
                          alt=""
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full object-contain ring-1 ring-bg-base"
                        />
                      </span>
                    ) : null}
                    USDC · Hyperliquid
                  </span>
                </div>
                <p className={cn('mt-1', EX.muted)}>
                  USDC on Hyperliquid only. Sending another asset or network can lose funds.
                </p>
              </div>

              <div className="rounded-md border border-border-subtle/40 bg-bg-sunken/30 p-3">
                <div className={EX.label}>Need USDC first?</div>
                <p className={cn('mt-1', EX.muted)}>
                  Convert or buy in your Pointer wallet, then bridge the USDC to Hyperliquid.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      requestExchange('convert');
                    }}
                    className={cn(EX.control, 'flex-1 justify-center font-semibold text-fg-secondary hover:text-fg-primary')}
                  >
                    Convert
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      requestExchange('buy');
                    }}
                    className={cn(EX.control, 'flex-1 justify-center font-semibold text-fg-secondary hover:text-fg-primary')}
                  >
                    Buy
                  </button>
                </div>
              </div>

              <a
                href="https://app.hyperliquid.xyz/trade"
                target="_blank"
                rel="noreferrer"
                className={cn('flex items-center justify-center gap-1', EX.link)}
              >
                Bridge USDC on Hyperliquid
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className={cn('max-w-xs leading-relaxed', EX.muted)}>
                Connect your wallet to see your Hyperliquid deposit address.
              </p>
            </div>
          )}
        </div>

        <div className={cn(EX.footer, 'flex items-center justify-between gap-3')}>
          <HyperliquidPoweredBy subtle />
          {hlAddress ? (
            <CopyButton
              value={hlAddress}
              toastLabel="Address copied"
              label="Copy address"
              className={cn(EX.cta, 'w-auto px-4')}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
