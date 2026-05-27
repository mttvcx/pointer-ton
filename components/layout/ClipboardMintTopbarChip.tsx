'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Zap } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { useClipboardMintPeek } from '@/lib/hooks/useClipboardMintPeek';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';

function formatQuickBuyChip(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (amount >= 100) return String(Math.round(amount));
  if (Number.isInteger(amount)) return String(amount);
  const s = amount.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

/**
 * Clipboard token shortcut — Axiom-style: tap token → page, tap ⚡ → quick buy.
 */
export function ClipboardMintTopbarChip() {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const quickBuySol = usePulseColumnStore((s) => s.byColumn.new.quickBuySol);
  const quickBuyUsdc = usePulseColumnStore((s) => s.byColumn.new.quickBuyUsdc);
  const { peekMint, dismissedRef, setPeekMint } = useClipboardMintPeek();
  const { buyToken, busyMint, canTrade } = usePulseQuickBuy();

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

  /**
   * Suppress chip when clipboard contains a base58 that isn't a known token mint
   * (most commonly: the user copied their own wallet address). Without this gate
   * the topbar leaks the wallet address as a `m6gB…cMdF` pill. Wait for the
   * summary query to confirm we actually have a token row before painting.
   */
  if (summaryQ.isFetched && !summaryQ.data) return null;

  const targetChain = appChainForMintNavigation(peekMint, activeChain);

  const sym = summaryQ.data?.symbol?.trim();
  const nm = summaryQ.data?.name?.trim();

  let label: string;
  if (sym) {
    label = sym.length > 14 ? `${sym.slice(0, 13)}…` : sym;
  } else if (nm) {
    label = nm.length > 20 ? `${nm.slice(0, 18)}…` : nm;
  } else if (summaryQ.isLoading) {
    label = shortenAddress(peekMint, 4);
  } else {
    return null;
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

  const buying = busyMint === peekMint;

  return (
    <div
      className={cn(
        'pointer-events-auto ml-2 flex h-8 max-w-[11rem] items-stretch overflow-hidden rounded-full border border-white/[0.06]',
        'bg-bg-hover/55 shadow-none sm:max-w-[13rem]',
        'animate-in fade-in zoom-in-95 duration-150',
      )}
      role="status"
      aria-live="polite"
      aria-label="Clipboard token shortcut"
    >
      <button
        type="button"
        onClick={openToken}
        title="Open token page"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-0 text-left outline-none transition-colors hover:bg-white/[0.04]',
          'focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
        )}
      >
        <TokenImage
          src={summaryQ.data?.image_url}
          alt=""
          size={18}
          className="!h-[18px] !w-[18px] shrink-0 rounded-[5px] opacity-90 ring-1 ring-white/[0.06]"
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none tracking-tight text-fg-secondary">
          {label}
        </span>
      </button>
      <button
        type="button"
        disabled={buying || !canTrade}
        title={canTrade ? `Quick buy ${quickBuyLabel}` : 'Connect wallet to quick buy'}
        aria-label={`Quick buy ${quickBuyLabel}`}
        onClick={onQuickBuy}
        className={cn(
          'flex shrink-0 items-center gap-1 border-l border-white/[0.06] px-2.5 text-fg-muted transition',
          'hover:bg-white/[0.04] hover:text-fg-secondary disabled:cursor-not-allowed disabled:opacity-45',
        )}
      >
        {buying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} aria-hidden />
        ) : (
          <Zap className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        )}
        <span className="text-[11px] font-semibold tabular-nums leading-none">{quickBuyLabel}</span>
      </button>
    </div>
  );
}
