'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Clipboard, Loader2, Zap } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { signalMintCopied } from '@/lib/clipboard/mintClipboardSignal';
import { useClipboardMintPeek } from '@/lib/hooks/useClipboardMintPeek';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { pulseMintCaptionLabel } from '@/components/tokens/PulseMintCopyCaption';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { shortenAddress } from '@/lib/utils/addresses';
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
  const { peekMint, dismissedRef, setPeekMint } = useClipboardMintPeek();
  const { buyToken, canTrade } = usePulseQuickBuy();
  const [copyFlash, setCopyFlash] = useState(false);

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
    void buyToken(peekMint, quickBuyAmount, {
      spendAsset: isUsdcQuickBuy ? 'usdc' : spendAsset,
    });
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
    <div
      className={cn(
        'pointer-events-auto inline-flex h-8 w-auto max-w-[10.5rem] shrink-0 items-stretch overflow-hidden rounded-full border border-white/[0.1]',
        'bg-bg-sunken/95 shadow-[0_8px_22px_-12px_rgba(0,0,0,0.6)]',
        'animate-in fade-in zoom-in-95 duration-150',
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
          'focus-ring flex w-8 shrink-0 items-center justify-center border-r border-white/[0.08] transition-colors',
          'text-fg-muted hover:bg-white/[0.05] hover:text-fg-primary',
          copyFlash && 'bg-accent-primary/12 text-accent-primary',
        )}
      >
        <Clipboard className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </button>

      <button
        type="button"
        onClick={openToken}
        title={`Open ${title} · ${caLabel}`}
        className={cn(
          'flex min-w-0 shrink items-center gap-1.5 px-1.5 text-left outline-none transition-colors hover:bg-white/[0.04]',
          'focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-inset',
        )}
      >
        {loadingMeta ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-bg-hover">
            <Loader2 className="h-3 w-3 animate-spin text-fg-muted" aria-hidden />
          </span>
        ) : (
          <TokenImage
            src={summaryQ.data?.image_url}
            alt=""
            size={20}
            className="!h-5 !w-5 shrink-0 rounded-[4px] ring-1 ring-white/[0.08]"
          />
        )}
        <span className="max-w-[4.25rem] truncate text-[12px] font-semibold tracking-tight text-fg-primary">
          {title}
        </span>
      </button>

      {activeChain === 'sol' ? (
        <button
          type="button"
          disabled={!canTrade}
          title={canTrade ? `Quick buy ${quickBuyLabel}` : 'Connect wallet to quick buy'}
          aria-label={`Quick buy ${quickBuyLabel}`}
          onClick={onQuickBuy}
          className={cn(
            'focus-ring flex shrink-0 items-center gap-0.5 border-l border-emerald-400/40 px-2',
            'text-emerald-400 transition hover:bg-emerald-400/[0.08]',
            'disabled:cursor-not-allowed disabled:opacity-45',
          )}
        >
          <Zap className="h-3 w-3 fill-emerald-400/30" strokeWidth={2.5} aria-hidden />
          <span className="text-[10px] font-semibold tabular-nums leading-none">{quickBuyLabel}</span>
        </button>
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
