'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Wallet as WalletIcon } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveWalletStore } from '@/store/activeWallet';
import { useTradingStore } from '@/store/trading';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber, parseLamportsStringToSol } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { Z_BOTTOM_BAR_POPOVER } from '@/lib/ui/zLayers';

type WalletPickerPlacement = 'above' | 'below';

interface WalletPickerPopoverProps {
  className?: string;
  children: React.ReactNode;
  /** `above` — opens over trigger (bottom bar). `below` — opens under trigger (Pulse top strip). */
  placement?: WalletPickerPlacement;
  align?: 'left' | 'right';
  title?: string;
}

const PANEL_W = 320;
const PANEL_GAP = 8;

/** Bottom-bar wallet multi-picker (reads `/api/wallets/my`, toggles trading-store shortlist). */
export function WalletPickerPopover({
  className,
  children,
  placement = 'above',
  align = 'left',
  title = 'Wallets',
}: WalletPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<
    { left: number; top?: number; bottom?: number } | null
  >(null);

  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);

  const { authenticated, getAccessToken } = usePointerAuth();
  const activeAddress = useActiveWalletStore((s) => s.activeWalletAddress);
  const shortlist = useTradingStore((s) => s.instantTradeWalletShortlist);
  const toggle = useTradingStore((s) => s.toggleInstantTradeWallet);
  const clear = useTradingStore((s) => s.clearInstantTradeWalletShortlist);

  const walletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const wallets = useMemo<MyWalletRow[]>(() => {
    return (walletsQ.data?.wallets ?? []).filter((w) => !w.is_archived);
  }, [walletsQ.data?.wallets]);

  const selected = useMemo(() => new Set(shortlist), [shortlist]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const leftRaw =
        align === 'right' ? r.right - PANEL_W : r.left;
      const left = Math.min(Math.max(8, leftRaw), Math.max(8, vw - PANEL_W - 8));
      if (placement === 'below') {
        setCoords({ left, top: r.bottom + PANEL_GAP });
      } else {
        setCoords({ left, bottom: window.innerHeight - r.top + PANEL_GAP });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, placement, align]);

  const selectAll = () => {
    clear();
    for (const w of wallets) toggle(w.wallet_address);
  };

  const selectAllWithBalance = () => {
    clear();
    for (const w of wallets) {
      const bal = parseLamportsStringToSol(w.balance_lamports);
      if (bal != null && bal > 0) toggle(w.wallet_address);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select wallets"
        title={title}
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) useTokenDockPeekStore.getState().setWalletPeekOpen(false);
            return next;
          })
        }
        className={cn(className)}
      >
        {children}
      </button>

      {mounted && open && coords
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Select wallets"
              style={{
                position: 'fixed',
                left: `${coords.left}px`,
                ...(coords.top != null
                  ? { top: `${coords.top}px` }
                  : { bottom: `${coords.bottom}px` }),
                width: `${PANEL_W}px`,
              }}
              className={cn(
                Z_BOTTOM_BAR_POPOVER,
                'rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-2xl',
              )}
            >
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={wallets.length === 0}
              className="btn-press focus-ring h-7 flex-1 rounded bg-bg-sunken px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={selectAllWithBalance}
              disabled={wallets.length === 0}
              className="btn-press focus-ring h-7 flex-1 rounded bg-bg-sunken px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select All with Balance
            </button>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {!authenticated ? (
              <div className="px-2 py-6 text-center text-[11px] text-fg-muted">
                Sign in to load wallets.
              </div>
            ) : walletsQ.isLoading ? (
              <div className="px-2 py-6 text-center text-[11px] text-fg-muted">
                Loading wallets...
              </div>
            ) : wallets.length === 0 ? (
              <div className="px-2 py-6 text-center text-[11px] text-fg-muted">
                No wallets yet.
              </div>
            ) : (
              wallets.map((w) => {
                const isSelected = selected.has(w.wallet_address);
                const isActive = w.wallet_address === activeAddress;
                const balanceUi = parseLamportsStringToSol(w.balance_lamports);
                const label = w.label?.trim() || `Wallet ${w.slot}`;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggle(w.wallet_address)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-bg-hover',
                      isActive && 'bg-accent-primary/[0.06]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors',
                        isSelected
                          ? 'bg-accent-primary text-fg-inverse'
                          : 'border border-border-subtle bg-bg-sunken',
                      )}
                      aria-hidden
                    >
                      {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium text-fg-primary">
                          {label}
                        </span>
                        {isActive ? (
                          <span className="rounded-sm bg-accent-primary/15 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-accent-primary">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-[10px] text-fg-muted">
                        {shortenAddress(w.wallet_address)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs tabular-nums text-fg-secondary">
                        {balanceUi != null
                          ? formatNumber(balanceUi, { decimals: 3 })
                          : '\u2014'}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide text-fg-muted">
                        {nativeSym}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2 text-[10px] text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <WalletIcon className="h-3 w-3" strokeWidth={2} />
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={() => clear()}
              disabled={selected.size === 0}
              className="text-fg-muted hover:text-fg-secondary disabled:opacity-40"
            >
              Clear
            </button>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
