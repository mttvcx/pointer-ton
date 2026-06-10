'use client';

import { ChevronDown, Layers, Search, Signal, Wallet2 } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';
import { ChainIcon } from '@/components/squads/ChainIcon';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';

/** Shared visual language for Portfolio “wallet operating system” — uses app theme tokens so light/axiom themes match. */
export const OS = {
  border: 'border-border-subtle',
  borderSoft: 'border-border-subtle/80',
  glass:
    'bg-bg-raised/95 backdrop-blur-xl shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.06)]',
  rowHover:
    'hover:bg-bg-hover/85 hover:shadow-[inset_0_0_0_1px_rgb(var(--accent-primary-rgb)/0.12)]',
  /** Portfolio Spot — single grey plane, hairline grid (Axiom-style). */
  spotSurface: 'bg-bg-raised',
  spotHairline: 'border-border-subtle/45',
  spotDivideX: 'divide-x divide-border-subtle/45',
  spotDivideY: 'divide-y divide-border-subtle/45',
  /** Tab + wallet chrome sits on page black; content panel is spotSurface below. */
  spotChrome: 'bg-bg-base',
  spotChromeHairline: 'border-white/[0.06]',
  trigger:
    'rounded-xl border border-border-default bg-gradient-to-b from-bg-hover to-bg-sunken shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.06)]',
};

export type BalanceFn = (lamports: string | null | undefined) => number;

export function WalletMonogram({ address, label }: { address: string; label: string | null }) {
  const raw = (label?.trim() || address).replace(/^0x/i, '');
  const pair = raw.length >= 2 ? raw.slice(0, 2) : raw.padEnd(2, '·');
  const sym = pair.toUpperCase();
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-white/[0.04] text-[10px] font-semibold tracking-tight text-fg-secondary"
      aria-hidden
    >
      {sym}
    </span>
  );
}

function KindBadges({ w, tradingAddress }: { w: MyWalletRow; tradingAddress: string | null }) {
  const isTrading = tradingAddress === w.wallet_address;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {w.is_primary ? (
        <span className="rounded border border-[#4a62d6]/45 bg-[#2f3f8a]/22 px-1.5 py-px text-[9px] font-semibold text-[#c7d8ff]">
          Primary
        </span>
      ) : null}
      {w.is_imported ? (
        <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-px text-[9px] font-semibold text-fg-muted">
          Imported
        </span>
      ) : (
        <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-1.5 py-px text-[9px] font-semibold text-emerald-200/90">
          Embedded
        </span>
      )}
      {isTrading ? (
        <span className="inline-flex items-center gap-0.5 rounded border border-cyan-900/55 bg-cyan-950/35 px-1.5 py-px text-[9px] font-semibold tabular-nums text-cyan-100/95">
          <Signal className="h-2.5 w-2.5" strokeWidth={2.8} />
          Trading
        </span>
      ) : null}
    </span>
  );
}

export type PortfolioWalletSelectorProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
  visibleWalletCount: number;
  walletsFiltered: MyWalletRow[];
  allVisible: MyWalletRow[];
  selectedId: 'all' | string;
  onSelectAll: () => void;
  onSelectWallet: (w: MyWalletRow) => void;
  combinedNative: number;
  /** Resolved balance for the selector chip (live when available). */
  headerNativeBalance: number;
  nativeSym: string;
  balanceOf: BalanceFn;
  selectedDisplayName: string;
  selectedWallet: MyWalletRow | null;
  tradingWalletAddress: string | null;
};

export function PortfolioWalletSelector({
  containerRef,
  open,
  onOpenChange,
  search,
  onSearchChange,
  visibleWalletCount,
  walletsFiltered,
  allVisible,
  selectedId,
  onSelectAll,
  onSelectWallet,
  combinedNative,
  headerNativeBalance,
  nativeSym,
  balanceOf,
  selectedDisplayName,
  selectedWallet,
  tradingWalletAddress,
}: PortfolioWalletSelectorProps) {
  const showSearch = visibleWalletCount > 8;
  const activeChain = useUIStore((s) => s.activeChain);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'inline-flex min-w-[220px] max-w-[min(420px,92vw)] items-center justify-between gap-3 py-1.5 text-left text-xs font-medium text-fg-primary transition',
          open && 'opacity-100',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <WalletMonogram
            address={selectedWallet?.wallet_address ?? 'combined'}
            label={selectedId === 'all' ? 'ALL' : selectedDisplayName}
          />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold tracking-tight text-fg-primary">
              {selectedDisplayName}
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-medium text-fg-muted">
              {selectedWallet
                ? shortenAddress(selectedWallet.wallet_address, 6)
                : `Combined · ${allVisible.length} wallet${allVisible.length === 1 ? '' : 's'}`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold tabular-nums text-fg-primary">
            <ChainIcon chain={activeChain} size={14} className="opacity-90" />
            {formatNumber(headerNativeBalance, {
              decimals: 4,
            })}
            <span className="text-[10px] font-medium text-fg-muted">{nativeSym}</span>
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-fg-muted transition duration-200', open && 'rotate-180')}
          />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 top-[calc(100%+8px)] z-[100] w-[min(400px,calc(100vw-20px))] overflow-hidden rounded-xl animate-in fade-in zoom-in-95 duration-200',
            OS.border,
            OS.glass,
          )}
        >
          <div className="border-b border-border-subtle bg-bg-base/95 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-fg-muted">Wallet scope</p>
              <span className="rounded-full border border-border-subtle bg-bg-sunken/80 px-2 py-px text-[10px] font-semibold tabular-nums text-fg-secondary">
                {nativeSym}
              </span>
            </div>
          </div>

          {showSearch ? (
            <div className="border-b border-border-subtle p-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-sunken/80 px-2.5 py-2 shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.04)] focus-within:border-accent-primary/40 focus-within:ring-1 focus-within:ring-accent-primary/22">
                <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2.2} />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter wallets…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-fg-primary outline-none placeholder:text-fg-muted"
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            role="option"
            aria-selected={selectedId === 'all'}
            onClick={onSelectAll}
            className={cn(
              'flex w-full items-center justify-between gap-3 border-b border-border-subtle px-3 py-3 text-left transition',
              OS.rowHover,
              selectedId === 'all' &&
                'bg-bg-hover shadow-[inset_3px_0_0_0_rgb(var(--accent-primary-rgb)),inset_0_0_0_1px_rgb(var(--accent-primary-rgb)/0.12)]',
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-primary/35 bg-accent-primary/10">
                <Layers className="h-4 w-4 text-accent-glow" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-fg-primary">All wallets</span>
                <span className="mt-0.5 block text-[10px] font-medium text-fg-muted">
                  Aggregated balance on this chain
                </span>
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[12px] font-semibold tabular-nums text-accent-glow">
                {formatNumber(combinedNative, { decimals: 4 })}
              </span>
              <span className="text-[10px] text-fg-muted">{allVisible.length} linked</span>
            </span>
          </button>

          <div className="max-h-[min(360px,52vh)] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-default-rgb))_transparent]">
            {walletsFiltered.map((w) => {
              const bal = balanceOf(w.balance_lamports);
              const selected = selectedId === w.id;
              const trading = tradingWalletAddress === w.wallet_address;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelectWallet(w)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b border-border-subtle px-3 py-2.5 text-left transition last:border-b-0',
                    OS.rowHover,
                    selected &&
                      'bg-bg-hover shadow-[inset_3px_0_0_0_rgb(var(--accent-primary-rgb)),inset_0_0_0_1px_rgb(var(--accent-primary-rgb)/0.1)]',
                    trading && !selected && 'bg-accent-primary/8',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <WalletMonogram address={w.wallet_address} label={w.label} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="truncate text-[12.5px] font-semibold text-fg-primary">
                          {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                        </span>
                        <KindBadges w={w} tradingAddress={tradingWalletAddress} />
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-fg-muted">
                        {shortenAddress(w.wallet_address, 7)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12px] font-semibold tabular-nums text-accent-glow">
                      {formatNumber(bal, { decimals: 4 })}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">{nativeSym}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type CapitalFunderPickerProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  wallets: MyWalletRow[];
  funderId: string | null;
  onSelectFunder: (id: string) => void;
  nativeSym: string;
  balanceOf: BalanceFn;
  receiverIds: Set<string>;
};

export function CapitalFunderPicker({
  open,
  onOpenChange,
  wallets,
  funderId,
  onSelectFunder,
  nativeSym,
  balanceOf,
  receiverIds,
}: CapitalFunderPickerProps) {
  const active = wallets.find((w) => w.id === funderId) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition',
          'border-border-default bg-gradient-to-b from-bg-hover to-bg-sunken shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.05)]',
          'hover:border-accent-primary/35',
          open && 'border-accent-primary/45 ring-1 ring-accent-primary/25',
          !active && 'border-dashed border-border-subtle',
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {active ? (
            <WalletMonogram address={active.wallet_address} label={active.label} />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-sunken/80">
              <Wallet2 className="h-4 w-4 text-fg-muted" strokeWidth={2} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-fg-muted">Source wallet</span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold text-fg-primary">
              {active ? active.label?.trim() || shortenAddress(active.wallet_address, 5) : 'Select funding wallet'}
            </span>
            {active ? (
              <span className="mt-0.5 block text-[10px] text-fg-secondary">
                <span className="font-mono">{shortenAddress(active.wallet_address, 8)}</span>
                {' · '}
                <span className="font-semibold tabular-nums text-accent-glow">
                  {formatNumber(balanceOf(active.balance_lamports), { decimals: 4 })} {nativeSym}
                </span>
              </span>
            ) : (
              <span className="mt-0.5 block text-[11px] text-fg-muted">Capital routes from this balance</span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-fg-muted transition duration-200', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[280px] overflow-y-auto rounded-xl border animate-in fade-in zoom-in-95 duration-200',
            OS.border,
            OS.glass,
          )}
        >
          <div className="border-b border-border-subtle px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">Choose source</p>
          </div>
          {wallets.map((w) => {
            const disabled = receiverIds.has(w.id);
            const sel = funderId === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectFunder(w.id);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5 text-left transition last:border-b-0',
                  OS.rowHover,
                  sel && 'bg-bg-hover shadow-[inset_3px_0_0_0_rgb(var(--accent-primary-rgb))]',
                  disabled && 'cursor-not-allowed opacity-35',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <WalletMonogram address={w.wallet_address} label={w.label} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-fg-primary">
                      {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-fg-muted">
                      {shortenAddress(w.wallet_address, 6)}
                      {disabled ? ' · also receiver' : ''}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-accent-glow">
                  {formatNumber(balanceOf(w.balance_lamports), { decimals: 3 })}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function WalletTableRowShell({
  children,
  className,
  selected,
  onClick,
  onDoubleClick,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).click();
              }
            }
          : undefined
      }
      className={cn(
        'group relative rounded-lg bg-transparent px-2.5 py-1.5 outline-none transition',
        'hover:bg-white/[0.03]',
        onClick &&
          'cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/35 focus-visible:ring-offset-0',
        selected && 'bg-white/[0.04]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CapitalFlowArrow({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 py-1.5', className)} aria-hidden>
      <div className="h-4 w-px bg-gradient-to-b from-transparent via-accent-primary/35 to-border-subtle" />
      <div className="rounded-full border border-border-subtle bg-bg-raised/90 p-1 shadow-[0_0_16px_-8px_rgb(var(--accent-primary-rgb)/0.35)]">
        <ChevronDown className="h-3.5 w-3.5 text-accent-glow" strokeWidth={2.6} />
      </div>
      <div className="h-4 w-px bg-gradient-to-b from-border-subtle via-accent-primary/35 to-transparent" />
    </div>
  );
}
