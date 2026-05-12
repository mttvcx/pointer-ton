'use client';

import { ChevronDown, Layers, Search, Signal, Wallet2 } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';

/** Shared visual language for Portfolio “wallet operating system” — dark, restrained, expensive. */
export const OS = {
  border: 'border-[#2a3d54]/85',
  borderSoft: 'border-[#1f2d3f]/90',
  glass:
    'bg-[#0b1018]/92 backdrop-blur-xl shadow-[0_24px_64px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]',
  rowHover: 'hover:bg-[#152232]/75 hover:shadow-[inset_0_0_0_1px_rgba(62,130,200,0.08)]',
  trigger:
    'rounded-xl border border-[#334d6a]/80 bg-gradient-to-b from-[#151f2e]/95 to-[#0a0f18] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
};

export type BalanceFn = (lamports: string | null | undefined) => number;

export function WalletMonogram({ address, label }: { address: string; label: string | null }) {
  const raw = (label?.trim() || address).replace(/^0x/i, '');
  const pair = raw.length >= 2 ? raw.slice(0, 2) : raw.padEnd(2, '·');
  const sym = pair.toUpperCase();
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-gradient-to-br from-[#1b3a5f]/55 to-[#0c1424] text-[11px] font-bold tracking-tight text-[#c7e4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-black/40"
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
  nativeSym,
  balanceOf,
  selectedDisplayName,
  selectedWallet,
  tradingWalletAddress,
}: PortfolioWalletSelectorProps) {
  const showSearch = visibleWalletCount > 8;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          OS.trigger,
          'inline-flex min-w-[220px] max-w-[min(420px,92vw)] items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition',
          'hover:border-[#4a6d94]/95 hover:shadow-[0_0_0_1px_rgba(56,130,200,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
          open && 'border-[#4f7ab8]/55 ring-1 ring-[#3b82c4]/35',
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
            <span className="block truncate text-[13px] font-semibold tracking-tight text-white">
              {selectedDisplayName}
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-medium text-[#7d8ea3]">
              {selectedWallet
                ? shortenAddress(selectedWallet.wallet_address, 6)
                : `Combined · ${allVisible.length} wallet${allVisible.length === 1 ? '' : 's'}`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[12px] font-semibold tabular-nums tracking-tight text-[#7cdbcc]">
            {formatNumber(selectedId === 'all' ? combinedNative : balanceOf(selectedWallet?.balance_lamports), {
              decimals: 4,
            })}{' '}
            <span className="text-[10px] font-semibold text-[#5eead4]/80">{nativeSym}</span>
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-[#6b8299] transition duration-200', open && 'rotate-180')}
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
          <div className="border-b border-white/[0.05] bg-[#0d1522]/95 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-[#6d8098]">Wallet scope</p>
              <span className="rounded-full border border-[#2f4a66]/80 bg-black/45 px-2 py-px text-[10px] font-semibold tabular-nums text-[#8ea3bd]">
                {nativeSym}
              </span>
            </div>
          </div>

          {showSearch ? (
            <div className="border-b border-white/[0.05] p-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-[#344b64]/85 bg-black/50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-[#4a6fa0]/85 focus-within:ring-1 focus-within:ring-[#3b6ea5]/25">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#5f7390]" strokeWidth={2.2} />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter wallets…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-white outline-none placeholder:text-[#4d5f78]"
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
              'flex w-full items-center justify-between gap-3 border-b border-white/[0.04] px-3 py-3 text-left transition',
              OS.rowHover,
              selectedId === 'all' &&
                'bg-[#1a2f4a]/55 shadow-[inset_3px_0_0_0_#3b9fd6,inset_0_0_0_1px_rgba(59,159,214,0.12)]',
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-950/60 bg-gradient-to-br from-cyan-950/50 to-[#0a121f]">
                <Layers className="h-4 w-4 text-cyan-200/90" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-white">All wallets</span>
                <span className="mt-0.5 block text-[10px] font-medium text-[#7d8ea3]">
                  Aggregated balance on this chain
                </span>
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[12px] font-semibold tabular-nums text-[#7cdbcc]">
                {formatNumber(combinedNative, { decimals: 4 })}
              </span>
              <span className="text-[10px] text-[#6b7d94]">{allVisible.length} linked</span>
            </span>
          </button>

          <div className="max-h-[min(360px,52vh)] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#2a3d54_transparent]">
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
                    'flex w-full items-center justify-between gap-3 border-b border-white/[0.03] px-3 py-2.5 text-left transition last:border-b-0',
                    OS.rowHover,
                    selected &&
                      'bg-[#1a2c42]/65 shadow-[inset_3px_0_0_0_#3b9fd6,inset_0_0_0_1px_rgba(59,159,214,0.1)]',
                    trading && !selected && 'bg-cyan-950/15',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <WalletMonogram address={w.wallet_address} label={w.label} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="truncate text-[12.5px] font-semibold text-white">
                          {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                        </span>
                        <KindBadges w={w} tradingAddress={tradingWalletAddress} />
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-[#6d8098]">
                        {shortenAddress(w.wallet_address, 7)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12px] font-semibold tabular-nums text-[#7cdbcc]">
                      {formatNumber(bal, { decimals: 4 })}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#5f7390]">{nativeSym}</span>
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
          'border-[#344d6a]/85 bg-gradient-to-b from-[#141c28]/95 to-[#080c12] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
          'hover:border-[#4f7096]/90',
          open && 'border-[#4f7ab8]/55 ring-1 ring-[#3b82c4]/30',
          !active && 'border-dashed border-[#3d556d]/70',
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {active ? (
            <WalletMonogram address={active.wallet_address} label={active.label} />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-[#455f78] bg-black/35">
              <Wallet2 className="h-4 w-4 text-[#6b8299]" strokeWidth={2} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f738e]">Source wallet</span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold text-white">
              {active ? active.label?.trim() || shortenAddress(active.wallet_address, 5) : 'Select funding wallet'}
            </span>
            {active ? (
              <span className="mt-0.5 block text-[10px] text-[#6d8098]">
                <span className="font-mono">{shortenAddress(active.wallet_address, 8)}</span>
                {' · '}
                <span className="font-semibold tabular-nums text-[#7cdbcc]">
                  {formatNumber(balanceOf(active.balance_lamports), { decimals: 4 })} {nativeSym}
                </span>
              </span>
            ) : (
              <span className="mt-0.5 block text-[11px] text-[#6d8098]">Capital routes from this balance</span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[#6b8299] transition duration-200', open && 'rotate-180')}
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
          <div className="border-b border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f738e]">Choose source</p>
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
                  'flex w-full items-center justify-between gap-2 border-b border-white/[0.03] px-3 py-2.5 text-left transition last:border-b-0',
                  OS.rowHover,
                  sel && 'bg-[#1a2c42]/70 shadow-[inset_3px_0_0_0_#3b9fd6]',
                  disabled && 'cursor-not-allowed opacity-35',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <WalletMonogram address={w.wallet_address} label={w.label} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-white">
                      {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-[#6d8098]">
                      {shortenAddress(w.wallet_address, 6)}
                      {disabled ? ' · also receiver' : ''}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#7cdbcc]">
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
        'group relative rounded-xl border border-transparent bg-gradient-to-b from-[#121a26]/5 to-transparent px-3 py-2.5 transition',
        'hover:border-[#3a5f7a]/45 hover:from-[#162232]/90 hover:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.85)]',
        onClick && 'cursor-pointer',
        selected &&
          'border-[#3b82c4]/40 from-[#1a2c42]/50 shadow-[inset_0_0_0_1px_rgba(59,130,214,0.15),0_0_24px_-16px_rgba(59,159,214,0.25)]',
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
      <div className="h-4 w-px bg-gradient-to-b from-transparent via-[#3d5f82]/70 to-[#4f7096]/90" />
      <div className="rounded-full border border-[#3a5f80]/50 bg-[#0d1522]/90 p-1 shadow-[0_0_16px_-8px_rgba(59,130,200,0.35)]">
        <ChevronDown className="h-3.5 w-3.5 text-[#7aa3cc]" strokeWidth={2.6} />
      </div>
      <div className="h-4 w-px bg-gradient-to-b from-[#4f7096]/90 via-[#3d5f82]/70 to-transparent" />
    </div>
  );
}
