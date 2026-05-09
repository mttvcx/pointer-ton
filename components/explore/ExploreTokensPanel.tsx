'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { PulseTokenBundle } from '@/types/tokens';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

export function ExploreTokensPanel() {
  const activeChain = useUIStore((s) => s.activeChain);
  const sym = nativeTicker(activeChain);

  const q = useQuery({
    queryKey: ['explore', activeChain],
    queryFn: async (): Promise<{ items: PulseTokenBundle[] }> => {
      const res = await fetch(`/api/explore?chain=${encodeURIComponent(activeChain)}&limit=50`);
      if (!res.ok) throw new Error('explore_failed');
      return res.json() as Promise<{ items: PulseTokenBundle[] }>;
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <h1 className="text-[17px] font-semibold text-fg-primary">Explore</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-snug text-fg-secondary">
          Top tokens by reported 24h volume for{' '}
          <span className="font-semibold text-fg-primary">{sym}</span> — matches your header chain
          toggle.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated/40">
        {q.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
          </div>
        ) : q.isError ? (
          <p className="p-6 text-[13px] text-signal-bear">Could not load explore data.</p>
        ) : !q.data?.items?.length ? (
          <p className="p-6 text-[13px] text-fg-secondary">
            No indexed tokens with snapshots for this chain yet. Try Pulse to ingest feeds, or switch
            chains.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Token</th>
                  <th className="px-3 py-2.5 tabular-nums">Mcap</th>
                  <th className="px-3 py-2.5 tabular-nums">Liquidity</th>
                  <th className="px-3 py-2.5 tabular-nums">Vol 24h</th>
                  <th className="px-3 py-2.5 tabular-nums">Holders</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((b, i) => (
                  <ExploreRow key={b.token.mint} rank={i + 1} bundle={b} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ExploreRow({ rank, bundle }: { rank: number; bundle: PulseTokenBundle }) {
  const { token, snapshot } = bundle;
  const label = token.symbol?.trim() || token.name?.trim() || shortenAddress(token.mint, 5);
  const sub =
    token.name && token.symbol ? token.name : shortenAddress(token.mint, 6);

  return (
    <tr className="border-b border-border-subtle/80 transition hover:bg-bg-hover/60">
      <td className="px-3 py-2.5 tabular-nums text-fg-muted">{rank}</td>
      <td className="px-3 py-2.5">
        <Link
          href={`/token/${encodeURIComponent(token.mint)}`}
          className="group flex items-center gap-2.5"
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-bg-base ring-1 ring-border-subtle">
            {token.image_url ? (
              // Many launchpads/CDNs — avoid Next image domain allowlist churn.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={token.image_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-fg-muted">
                {(label.slice(0, 2) || '?').toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-fg-primary group-hover:text-accent-primary">
              {label}
            </div>
            <div className="truncate text-[11px] text-fg-muted">{sub}</div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-primary">
        {formatCompactUsd(snapshot?.market_cap_usd)}
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
        {formatCompactUsd(snapshot?.liquidity_usd)}
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-primary">
        {formatCompactUsd(snapshot?.volume_24h_usd)}
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
        {snapshot?.holder_count != null ? snapshot.holder_count.toLocaleString() : '—'}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          href={`/token/${encodeURIComponent(token.mint)}`}
          className={cn(
            'inline-flex rounded-md bg-accent-primary px-2.5 py-1 text-[11px] font-semibold text-fg-inverse',
            'hover:bg-accent-glow',
          )}
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
