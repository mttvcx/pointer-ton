'use client';

import { useEffect, useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { formatRelativeTime } from '@/lib/utils/formatters';
import type { SolWalletActivityItem } from '@/lib/solana/wallet-activity';

export function WalletSolActivityPanel({ address }: { address: string }) {
  const [activity, setActivity] = useState<SolWalletActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/wallet/${encodeURIComponent(address)}/activity`);
        const json = (await res.json()) as { activity?: SolWalletActivityItem[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'activity_failed');
        if (!cancelled) setActivity(json.activity ?? []);
      } catch (e) {
        if (!cancelled) {
          setActivity([]);
          setError(e instanceof Error ? e.message : 'activity_failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) {
    return (
      <div className="space-y-2 px-1 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-bg-hover/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Activity}
        title="Activity unavailable"
        description="On-chain history loads only when you open this wallet page."
      />
    );
  }

  if (activity.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No recent activity"
        description="No indexed transactions for this wallet yet."
      />
    );
  }

  return (
    <ul className="divide-y divide-border-subtle/50">
      {activity.map((item) => (
        <li key={item.signature} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
              <span className="text-sm font-medium text-fg-primary">{item.label}</span>
              {!item.success ? (
                <span className="rounded bg-signal-bear/15 px-1.5 py-0.5 text-[10px] font-medium text-signal-bear">
                  failed
                </span>
              ) : null}
            </div>
            {item.sublabel ? (
              <p className="mt-0.5 truncate text-xs text-fg-muted">{item.sublabel}</p>
            ) : null}
            {item.blockTime ? (
              <p className="mt-1 text-[11px] text-fg-muted">
                {formatRelativeTime(new Date(item.blockTime * 1000).toISOString())}
              </p>
            ) : null}
          </div>
          <a
            href={explorerUrlSolanaTx(item.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-accent-primary hover:underline"
          >
            Tx
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
