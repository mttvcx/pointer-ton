'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import type { AppChainId } from '@/lib/chains/appChain';
import { useClipboardMintPeek } from '@/lib/hooks/useClipboardMintPeek';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

function chainTicker(chain: AppChainId): string {
  const m: Record<AppChainId, string> = {
    sol: 'SOL',
    bnb: 'BNB',
    base: 'BASE',
    ton: 'TON',
  };
  return m[chain];
}

/**
 * Compact clipboard token shortcut — sits beside the co-pilot pill in {@link Topbar}.
 * Opens `/token/[mint]` and syncs the header chain toggle so Pulse matches after navigation.
 */
export function ClipboardMintTopbarChip() {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const { peekMint, dismiss, dismissedRef, setPeekMint } = useClipboardMintPeek();

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

  if (!peekMint) return null;

  const targetChain = appChainForMintNavigation(peekMint, activeChain);

  const sym = summaryQ.data?.symbol?.trim();
  const nm = summaryQ.data?.name?.trim();

  /** One-line label — never show the full raw mint in the chip. */
  let label: string;
  if (sym) {
    label = sym.length > 14 ? `${sym.slice(0, 13)}…` : sym;
  } else if (nm) {
    label = nm.length > 20 ? `${nm.slice(0, 18)}…` : nm;
  } else {
    label = shortenAddress(peekMint, 4);
  }

  const openToken = () => {
    useUIStore.getState().setActiveChain(targetChain);
    dismissedRef.current = peekMint;
    setPeekMint(null);
    router.push(`/token/${encodeURIComponent(peekMint)}`);
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex h-8 max-w-[10.5rem] items-stretch overflow-hidden rounded-full border border-white/[0.1]',
        'bg-bg-sunken/92 shadow-[0_8px_22px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md sm:max-w-[12.5rem]',
        'animate-in fade-in zoom-in-95 duration-150',
      )}
      role="status"
      aria-live="polite"
      aria-label="Clipboard token shortcut"
    >
      <button
        type="button"
        onClick={openToken}
        title="Open token page · switches chain header"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 px-2 py-0 text-left outline-none transition-colors hover:bg-bg-hover',
          'focus-visible:ring-2 focus-visible:ring-accent-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
        )}
      >
        <TokenImage
          src={summaryQ.data?.image_url}
          alt=""
          size={18}
          className="!h-[18px] !w-[18px] shrink-0 rounded-[6px] ring-1 ring-white/[0.08]"
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-none tracking-tight text-fg-primary">
          {label}
        </span>
        <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide text-fg-muted opacity-90">
          {chainTicker(targetChain)}
        </span>
      </button>
      <button
        type="button"
        className="flex w-7 shrink-0 items-center justify-center border-l border-white/[0.08] text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
