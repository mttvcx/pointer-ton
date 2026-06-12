'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CompactInstantTradePanel } from '@/components/trading/CompactInstantTradePanel';
import { useTradingStore } from '@/store/trading';

function mintFromTokenPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/token\/([^/?#]+)/);
  return m?.[1] ?? null;
}

/** Shell-mounted instant trade — survives mint-to-mint navigation on token pages. */
export function TokenInstantTradeHost() {
  const pathname = usePathname();
  const mint = useMemo(() => mintFromTokenPath(pathname), [pathname]);
  const open = useTradingStore((s) => s.compactInstantTradeOpen);
  const setOpen = useTradingStore((s) => s.setCompactInstantTradeOpen);

  const metaQ = useQuery({
    queryKey: ['token-instant-meta', mint],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint!)}`);
      if (!res.ok) throw new Error('token_meta');
      const json = (await res.json()) as {
        token: { symbol: string | null; decimals: number };
        snapshot: { price_usd: number | null } | null;
      };
      return {
        symbol: json.token.symbol,
        decimals: json.token.decimals,
        priceUsd: json.snapshot?.price_usd ?? null,
      };
    },
    // Only resolve symbol/decimals when the instant-trade overlay is open.
    // Closed overlay needs nothing; quick-buy still works because the panel
    // fetches on open (120s cache keeps repeat opens instant).
    enabled: Boolean(mint && open),
    staleTime: 120_000,
  });

  if (!mint) return null;

  return (
    <CompactInstantTradePanel
      mint={mint}
      symbol={metaQ.data?.symbol ?? null}
      decimals={metaQ.data?.decimals ?? 6}
      priceUsd={metaQ.data?.priceUsd ?? null}
      open={open}
      onClose={() => setOpen(false)}
      onOpenFullTradeSettings={() => {
        document.querySelector<HTMLElement>(`[data-mint="${mint}"]`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }}
    />
  );
}
