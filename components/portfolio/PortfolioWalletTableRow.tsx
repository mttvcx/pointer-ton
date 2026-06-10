'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Copy, ExternalLink, EyeOff, KeyRound, Pencil, Rocket, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import type { AppChainId } from '@/lib/chains/appChain';
import { SpotTickerIcon } from '@/components/chains/SpotTickerIcon';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { WalletMonogram, WalletTableRowShell } from '@/components/portfolio/walletOs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function HoldingsPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-[11px] text-fg-secondary">
      <span className="inline-flex h-3 w-[18px] flex-col justify-between opacity-70" aria-hidden>
        <span className="block h-px w-full rounded-full bg-fg-muted/70" />
        <span className="block h-px w-full rounded-full bg-fg-muted/70" />
        <span className="block h-px w-full rounded-full bg-fg-muted/70" />
      </span>
      <span>{count}</span>
    </span>
  );
}

function RowAction({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md transition',
            active
              ? 'text-accent-glow hover:bg-accent-primary/15'
              : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-primary',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function PortfolioWalletTableRow({
  wallet: w,
  activeChain,
  trading,
  selected,
  balanceSol,
  holdingsCount = 0,
  onSelect,
  onOpenAnalytics,
  onSaveLabel,
  onArchive,
  onExportKey,
  onSetPrimary,
  onSetTrading,
  explorerUrl,
}: {
  wallet: MyWalletRow;
  activeChain: AppChainId;
  trading: boolean;
  selected: boolean;
  balanceSol: number;
  holdingsCount?: number;
  onSelect: () => void;
  onOpenAnalytics: () => void;
  onSaveLabel: (label: string) => Promise<void>;
  onArchive: () => void;
  onExportKey: () => void;
  onSetPrimary: () => void;
  onSetTrading: () => void;
  explorerUrl: string;
}) {
  const displayName = w.label?.trim() || `Wallet ${w.slot}`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(displayName);
  }, [displayName, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitLabel = useCallback(async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === displayName) return;
    setSaving(true);
    try {
      await onSaveLabel(next);
    } finally {
      setSaving(false);
    }
  }, [draft, displayName, onSaveLabel]);

  return (
    <WalletTableRowShell selected={selected} onClick={onSelect} onDoubleClick={onOpenAnalytics}>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <WalletMonogram address={w.wallet_address} label={w.label} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {w.is_primary ? (
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" strokeWidth={2} aria-label="Primary wallet" />
            ) : null}
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                disabled={saving}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') void commitLabel();
                  if (e.key === 'Escape') {
                    setDraft(displayName);
                    setEditing(false);
                  }
                }}
                onBlur={() => void commitLabel()}
                className="max-w-[9rem] rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px] font-medium text-fg-primary outline-none ring-1 ring-accent-primary/25"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className={cn(
                  'group/name inline-flex max-w-[10rem] items-center gap-1 truncate text-left text-[12px] font-medium text-fg-primary',
                  'rounded px-0.5 transition hover:bg-white/[0.04]',
                )}
              >
                <span className="truncate">{displayName}</span>
                <Pencil
                  className="h-3 w-3 shrink-0 text-fg-muted opacity-0 transition group-hover/name:opacity-100"
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            )}
            {w.is_primary ? (
              <span className="rounded bg-[#2f3f8a]/25 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#c7d8ff]">
                Primary
              </span>
            ) : null}
            {trading ? (
              <span className="rounded bg-cyan-950/35 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-cyan-100/90">
                Live
              </span>
            ) : null}
            {w.is_archived ? (
              <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                Archived
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-fg-muted">
              {shortenAddress(w.wallet_address, 4)}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(w.wallet_address);
                      toast.success('Address copied');
                    }}
                    className="rounded p-0.5 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                    aria-label="Copy address"
                  >
                    <Copy className="h-3 w-3" strokeWidth={2} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] font-medium">
                  Copy address
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-6">
          <div className="flex items-center gap-6 transition-opacity duration-150 group-hover:opacity-30">
            <span className="inline-flex min-w-[4.5rem] items-center justify-end gap-1 tabular-nums">
              <SpotTickerIcon symbol={nativeTicker(activeChain)} />
              <TerminalNativeBalance amount={balanceSol} className="text-[11px] font-medium text-fg-primary" />
            </span>
            <span className="min-w-[2.5rem] text-right">
              <HoldingsPill count={holdingsCount} />
            </span>
          </div>

          <div
            className={cn(
              'pointer-events-none absolute inset-y-[-2px] right-0 flex items-center justify-end',
              'bg-gradient-to-l from-bg-base via-bg-base/95 to-transparent pl-10',
              'opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle/80 bg-bg-raised/95 px-1 py-0.5 shadow-panel backdrop-blur-sm">
              <RowAction
                label={trading ? 'Trading wallet' : 'Set as trading wallet'}
                active={trading}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetTrading();
                }}
              >
                <Rocket className="h-3.5 w-3.5" strokeWidth={2} />
              </RowAction>
              <RowAction
                label={w.is_archived ? 'Unarchive wallet' : 'Archive wallet'}
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
              >
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
              </RowAction>
              <RowAction
                label={`Open in ${activeChain === 'sol' ? 'Solscan' : 'explorer'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </RowAction>
              <RowAction
                label="Export private key"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportKey();
                }}
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
              </RowAction>
              {!w.is_primary ? (
                <RowAction
                  label="Make Primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary();
                  }}
                >
                  <Star className="h-3.5 w-3.5" strokeWidth={2} />
                </RowAction>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </WalletTableRowShell>
  );
}
