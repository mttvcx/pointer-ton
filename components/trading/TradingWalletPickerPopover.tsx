'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Settings, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeSpendIconSrc } from '@/lib/chains/chainAssets';
import { useOverlayPresence, SETTINGS_POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { SettingsPopoverPortal } from '@/components/ui/SettingsPopoverPortal';
import { BlitzWalletChip } from '@/components/trading/BlitzWalletChip';
import { WalletMenuNativeBalance } from '@/components/wallets/WalletMenuNativeBalance';
import { WalletMenuTokenBalance } from '@/components/wallets/WalletMenuTokenBalance';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { lamportsToSol, rawToUi } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { resolveWalletDisplayNames } from '@/lib/wallets/walletDisplayName';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

export type TradingWalletPickerPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: MyWalletRow[];
  selectedAddresses: string[];
  onToggleWallet: (address: string) => void;
  onSelectWallets: (rows: MyWalletRow[]) => void;
  /** Combined native balance across selected wallets (for trigger chip). */
  triggerBalanceSol: number;
  activeChain: AppChainId;
  onSettingsClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Demo amount on Enable Blitz modal buy chip. */
  demoBuyAmount?: number;
  /** Desk token — secondary balance column (Axiom parity). */
  tokenSymbol?: string | null;
  tokenImageUrl?: string | null;
  tokenDecimals?: number;
  /** wallet address → raw token amount */
  tokenBalanceRawByAddress?: ReadonlyMap<string, string>;
};

function walletSolUi(w: MyWalletRow): number {
  if (!w.balance_lamports) return 0;
  try {
    return lamportsToSol(BigInt(w.balance_lamports));
  } catch {
    return 0;
  }
}

function hasPositiveBalance(w: MyWalletRow): boolean {
  if (!w.balance_lamports || w.is_archived || !w.is_active) return false;
  try {
    return BigInt(w.balance_lamports) > 0n;
  } catch {
    return false;
  }
}

function walletTokenUi(
  address: string,
  tokenBalanceRawByAddress: ReadonlyMap<string, string> | undefined,
  tokenDecimals: number,
): number {
  const raw = tokenBalanceRawByAddress?.get(address) ?? '0';
  if (!raw || raw === '0') return 0;
  try {
    return rawToUi(raw, tokenDecimals);
  } catch {
    return 0;
  }
}

/** Trade-panel multi-wallet picker — Pointer grey theme, dim scrim, subscript balances. */
export function TradingWalletPickerPopover({
  open,
  onOpenChange,
  wallets,
  selectedAddresses,
  onToggleWallet,
  onSelectWallets,
  triggerBalanceSol,
  activeChain,
  onSettingsClick,
  disabled,
  className,
  demoBuyAmount,
  tokenSymbol,
  tokenImageUrl,
  tokenDecimals = 6,
  tokenBalanceRawByAddress,
}: TradingWalletPickerPopoverProps) {
  const { mounted, visible } = useOverlayPresence(open, SETTINGS_POPOVER_ANIM_CLOSE_MS);
  const pickerDisplayNames = useMemo(() => resolveWalletDisplayNames(wallets), [wallets]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  const selectedCount = selectedAddresses.length;
  const allSelected =
    wallets.length > 0 &&
    wallets.every((w) => !w.is_archived && w.is_active && selectedAddresses.includes(w.wallet_address));

  const showTokenColumn = Boolean(tokenSymbol && tokenBalanceRawByAddress);

  function updatePosition() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) });
  }

  useLayoutEffect(() => {
    if (!mounted || !visible) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, visible]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <div className={cn('relative ml-auto flex max-w-[48%] shrink-0 items-center', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select trading wallets"
        className={cn(
          'focus-ring inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-2 text-[11px] font-semibold leading-none transition-colors',
          open
            ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary ring-1 ring-accent-primary/25'
            : 'border-border-subtle bg-bg-raised text-fg-secondary hover:border-border-default hover:bg-bg-hover hover:text-fg-primary',
          disabled && 'cursor-not-allowed opacity-45',
        )}
      >
        <Wallet className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="tabular-nums">{selectedCount}</span>
        <img
          src={nativeSpendIconSrc(activeChain)}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 shrink-0 object-contain"
          draggable={false}
          aria-hidden
        />
        <TerminalNativeBalance
          amount={triggerBalanceSol}
          className="min-w-0 truncate text-[11px] font-semibold text-fg-primary"
        />
      </button>

      <SettingsPopoverPortal
        mounted={mounted}
        visible={visible}
        onClose={() => onOpenChange(false)}
        popoverRef={popoverRef}
        zIndexClass={Z_APP_MODAL_OVERLAY}
        aria-label="Select trading wallets"
        panelClassName="w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl"
        style={{ top: coords.top, right: coords.right }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  onSelectWallets([]);
                } else {
                  onSelectWallets(wallets.filter((w) => !w.is_archived && w.is_active));
                }
              }}
              className="btn-press focus-ring h-7 rounded bg-bg-sunken px-2.5 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              {allSelected ? 'Unselect All' : 'Select All'}
            </button>
            <button
              type="button"
              onClick={() => onSelectWallets(wallets.filter(hasPositiveBalance))}
              className="btn-press focus-ring h-7 rounded bg-bg-sunken px-2.5 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              Select All with Balance
            </button>
          </div>
          {onSettingsClick ? (
            <button
              type="button"
              onClick={onSettingsClick}
              className="focus-ring shrink-0 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
              aria-label="Multi wallet buy settings"
              title="Multi wallet buy settings"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <div className="max-h-[min(52vh,380px)] overflow-y-auto overscroll-contain px-1 py-1 [scrollbar-width:thin]">
          {wallets.map((w, i) => {
            const selected = selectedAddresses.includes(w.wallet_address);
            const sol = walletSolUi(w);
            const tokenUi = showTokenColumn
              ? walletTokenUi(w.wallet_address, tokenBalanceRawByAddress, tokenDecimals)
              : 0;
            const label = pickerDisplayNames.get(w.id) ?? w.label?.trim() ?? `Pointer Wallet ${i + 1}`;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onToggleWallet(w.wallet_address)}
                className={cn(
                  'grid w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-hover',
                  showTokenColumn
                    ? 'grid-cols-[1.75rem_1fr_auto]'
                    : 'grid-cols-[1.75rem_1fr_auto]',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded transition-colors',
                    selected
                      ? 'bg-accent-primary text-fg-inverse'
                      : 'border border-border-subtle bg-bg-sunken',
                  )}
                  aria-hidden
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-fg-primary">{label}</span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-fg-muted">
                    <BlitzWalletChip
                      walletAddress={w.wallet_address}
                      walletLabel={label}
                      activeChain={activeChain}
                      demoBuyAmount={demoBuyAmount}
                    />
                    <span aria-hidden>·</span>
                    <span>{w.is_imported ? 'View-only' : 'Trading'}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{shortenAddress(w.wallet_address, 4)}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      className="inline-flex shrink-0 rounded p-0.5 text-fg-muted hover:text-fg-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard.writeText(w.wallet_address).then(
                          () => toastCopied(w.wallet_address),
                          () => toastCopyFailed(),
                        );
                      }}
                      aria-label="Copy wallet address"
                    >
                      <Copy className="h-3 w-3" strokeWidth={2} />
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  <WalletMenuNativeBalance
                    amount={sol}
                    activeChain={activeChain}
                    amountClassName="text-[11px] text-fg-primary"
                    className="rounded-md border border-border-subtle bg-bg-sunken px-2 py-1"
                  />
                  {showTokenColumn ? (
                    <WalletMenuTokenBalance
                      amount={tokenUi}
                      symbol={tokenSymbol}
                      imageUrl={tokenImageUrl}
                      amountClassName="text-[11px] text-fg-primary"
                      className={cn(
                        'rounded-md border border-border-subtle bg-bg-sunken px-2 py-1',
                        tokenUi <= 0 && 'opacity-40',
                      )}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
          {wallets.length === 0 ? (
            <div className="px-3 py-10 text-center text-[12px] text-fg-secondary">No wallets found</div>
          ) : null}
        </div>
      </SettingsPopoverPortal>
    </div>
  );
}
