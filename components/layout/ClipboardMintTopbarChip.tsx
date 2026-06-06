'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Clipboard, Loader2, Zap } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { signalMintCopied } from '@/lib/clipboard/mintClipboardSignal';
import { useClipboardMintPeek } from '@/lib/hooks/useClipboardMintPeek';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { pulseMintCaptionLabel } from '@/components/tokens/PulseMintCopyCaption';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { shortenAddress } from '@/lib/utils/addresses';
import { BUY_PRESETS_SOL, BUY_PRESETS_USDC } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';

/** Reserved width in topbar center — keeps copilot pill from shifting when chip mounts. */
export const CLIPBOARD_TOPBAR_SLOT_PX = 200;

function formatQuickBuyChip(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (amount >= 100) return String(Math.round(amount));
  if (Number.isInteger(amount)) return String(amount);
  const s = amount.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

/**
 * Clipboard CA shortcut (Axiom-style): compact pill — copy, symbol, quick buy.
 */
export function ClipboardMintTopbarChip() {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const quickBuySol = usePulseColumnStore((s) => s.byColumn.new.quickBuySol);
  const quickBuyUsdc = usePulseColumnStore((s) => s.byColumn.new.quickBuyUsdc);
  const setQuickBuySol = usePulseColumnStore((s) => s.setQuickBuySol);
  const setQuickBuyUsdc = usePulseColumnStore((s) => s.setQuickBuyUsdc);
  const { peekMint, dismissedRef, setPeekMint } = useClipboardMintPeek();
  const { buyToken, canTrade } = usePulseQuickBuy();
  const [copyFlash, setCopyFlash] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorOpen) return;
    function onDown(e: MouseEvent) {
      if (editorRef.current?.contains(e.target as Node)) return;
      setEditorOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditorOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [editorOpen]);

  const summaryQ = useQuery({
    queryKey: ['clipboard-mint-summary', peekMint],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/summary?mints=${encodeURIComponent(peekMint!)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        tokens?: { mint: string; symbol: string | null; name: string | null; image_url: string | null }[];
      };
      return json.tokens?.[0] ?? null;
    },
    enabled: Boolean(peekMint),
    staleTime: 60_000,
    retry: false,
  });

  const isUsdcQuickBuy = activeChain === 'sol' && spendAsset === 'usdc';
  const quickBuyAmount = isUsdcQuickBuy ? quickBuyUsdc : quickBuySol;
  const quickBuyLabel = useMemo(
    () => formatQuickBuyChip(quickBuyAmount),
    [quickBuyAmount],
  );

  if (!peekMint) return null;

  if (summaryQ.isFetched && !summaryQ.data) return null;

  const targetChain = appChainForMintNavigation(peekMint, activeChain);
  const sym = summaryQ.data?.symbol?.trim();
  const nm = summaryQ.data?.name?.trim();
  const caLabel = pulseMintCaptionLabel(peekMint);

  let title: string;
  if (sym) {
    title = sym.length > 10 ? `${sym.slice(0, 9)}…` : sym;
  } else if (nm) {
    title = nm.length > 12 ? `${nm.slice(0, 11)}…` : nm;
  } else {
    title = shortenAddress(peekMint, 3);
  }

  const openToken = () => {
    useUIStore.getState().setActiveChain(targetChain);
    dismissedRef.current = peekMint;
    setPeekMint(null);
    router.push(`/token/${encodeURIComponent(peekMint)}`);
  };

  const onQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!Number.isFinite(quickBuyAmount) || quickBuyAmount <= 0) return;
    // USDC spend only applies on Solana; every other chain quick-buys with its
    // own native token (BNB, ETH, BASE, TON).
    void buyToken(peekMint, quickBuyAmount, {
      spendAsset: isUsdcQuickBuy ? 'usdc' : 'sol',
    });
  };

  const quickBuyUnit = isUsdcQuickBuy ? 'USDC' : nativeTicker(activeChain);
  const quickBuyPresets = isUsdcQuickBuy ? BUY_PRESETS_USDC : BUY_PRESETS_SOL;
  const setQuickBuyAmount = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    if (isUsdcQuickBuy) setQuickBuyUsdc('new', n);
    else setQuickBuySol('new', n);
  };

  async function copyMint(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const mint = peekMint;
    if (!mint) return;
    try {
      await navigator.clipboard.writeText(mint);
      signalMintCopied(mint);
      toastCopied(mint);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 700);
    } catch {
      toastCopyFailed();
    }
  }

  const loadingMeta = summaryQ.isLoading && !summaryQ.data;

  return (
    <div ref={editorRef} className="pointer-events-auto relative inline-flex">
      <div
        className={cn(
          'inline-flex h-8 w-auto max-w-[12.5rem] shrink-0 items-stretch overflow-hidden rounded-full',
          'border border-border-subtle bg-bg-hover',
        )}
        role="status"
        aria-live="polite"
        aria-label={`Clipboard token ${title}`}
      >
        <button
          type="button"
          onClick={(e) => void copyMint(e)}
          title={`Copy ${caLabel}`}
          aria-label="Copy contract address"
          className={cn(
            'focus-ring flex w-7 shrink-0 items-center justify-center border-r border-border-subtle transition-colors',
            'text-fg-muted hover:bg-bg-raised/60 hover:text-fg-secondary',
            copyFlash && 'bg-accent-primary/10 text-accent-primary',
          )}
        >
          <Clipboard className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>

        <button
          type="button"
          onClick={openToken}
          title={`Open ${title} · ${caLabel}`}
          className={cn(
            'flex min-w-0 shrink items-center gap-1.5 px-1.5 text-left outline-none transition-colors',
            'hover:bg-bg-raised/50 focus-visible:ring-1 focus-visible:ring-border-default focus-visible:ring-inset',
          )}
        >
          {loadingMeta ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-bg-raised">
              <Loader2 className="h-3 w-3 animate-spin text-fg-muted" aria-hidden />
            </span>
          ) : (
            <TokenImage
              src={summaryQ.data?.image_url}
              alt=""
              size={20}
              className="!h-5 !w-5 shrink-0 rounded-[4px] ring-1 ring-border-subtle"
            />
          )}
          <span className="max-w-[4.25rem] truncate text-[12px] font-semibold tracking-tight text-fg-primary">
            {title}
          </span>
        </button>

        <div
          className={cn(
            'flex shrink-0 items-stretch border-l border-border-subtle bg-bg-raised/70',
            editorOpen && 'bg-bg-raised',
          )}
        >
          <button
            type="button"
            disabled={!canTrade}
            title={canTrade ? `Quick buy ${quickBuyLabel} ${quickBuyUnit}` : 'Connect wallet to quick buy'}
            aria-label={`Quick buy ${quickBuyLabel} ${quickBuyUnit}`}
            onClick={onQuickBuy}
            className={cn(
              'focus-ring flex items-center gap-0.5 px-1.5 text-fg-secondary transition-colors',
              'hover:bg-bg-hover/80 hover:text-fg-primary',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Zap className="h-3 w-3 text-signal-bull/90" strokeWidth={2.25} aria-hidden />
            <span className="text-[10px] font-semibold tabular-nums leading-none">{quickBuyLabel}</span>
          </button>
          <button
            type="button"
            title="Edit quick buy amount"
            aria-label="Edit quick buy amount"
            aria-expanded={editorOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditorOpen((v) => !v);
            }}
            className={cn(
              'focus-ring flex w-5 shrink-0 items-center justify-center pr-0.5 text-fg-muted transition-colors',
              'hover:bg-bg-hover/80 hover:text-fg-secondary',
              editorOpen && 'text-fg-secondary',
            )}
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform duration-150', editorOpen && 'rotate-180')}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {editorOpen ? (
        <div
          role="dialog"
          aria-label="Quick buy amount"
          className={cn(
            'absolute right-0 top-[calc(100%+4px)] z-[210] w-[12.5rem] rounded-md',
            'border border-border-subtle bg-bg-raised p-2 shadow-sm',
          )}
        >
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
              Quick buy
            </span>
            <span className="text-[9px] font-medium text-fg-muted">{quickBuyUnit}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {quickBuyPresets.map((preset) => {
              const active = Math.abs(preset - quickBuyAmount) < 1e-9;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuickBuyAmount(preset)}
                  className={cn(
                    'h-7 rounded-md text-[11px] font-semibold tabular-nums transition-colors',
                    active
                      ? 'bg-bg-hover text-fg-primary ring-1 ring-border-default'
                      : 'bg-bg-sunken/80 text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                  )}
                >
                  {formatQuickBuyChip(preset)}
                </button>
              );
            })}
          </div>
          <label className="mt-1.5 flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-sunken/80 px-2 py-1">
            <input
              type="number"
              min={isUsdcQuickBuy ? 1 : 0.01}
              step={isUsdcQuickBuy ? 1 : 0.01}
              defaultValue={quickBuyAmount}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n) && n > 0) setQuickBuyAmount(n);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[11px] text-fg-primary outline-none placeholder:text-fg-muted"
              aria-label={`Custom quick buy amount in ${quickBuyUnit}`}
            />
            <span className="shrink-0 text-[9px] font-medium text-fg-muted">{quickBuyUnit}</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/** Fixed-width mount so the center pill never shifts when a CA appears. */
export function ClipboardMintTopbarSlot() {
  return (
    <div
      className="pointer-events-none hidden shrink-0 items-center justify-start pl-1.5 sm:flex"
      style={{ width: CLIPBOARD_TOPBAR_SLOT_PX }}
    >
      <ClipboardMintTopbarChip />
    </div>
  );
}
