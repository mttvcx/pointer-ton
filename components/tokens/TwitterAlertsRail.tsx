'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';

type TweetListenPayload = {
  message?: string;
  ruleName?: string;
  handle?: string;
  tweetUrl?: string | null;
  mint?: string | null;
  execution?: string;
  autoHeldReason?: string | null;
};

function readPayload(p: unknown): TweetListenPayload {
  return p && typeof p === 'object' ? (p as TweetListenPayload) : {};
}

export function TwitterAlertsRail({ dock }: { dock: 'left' | 'right' }) {
  const { data, isFetching } = useAlertsTickerQuery({ pollAggressively: true });
  const setRailSide = usePulseTwitterRailStore((s) => s.setSide);

  const rows = useMemo(() => {
    const list = data ?? [];
    return list.filter((a) => a.type === ALERT_TYPE_TWITTER_LISTEN);
  }, [data]);

  return (
    <section
      className={cn(
        'flex min-h-[200px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised xl:min-h-0',
      )}
      data-dock={dock}
    >
      <header className="shrink-0 border-b border-border-subtle bg-bg-hover px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-primary">
            X listens
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-fg-muted">
              {isFetching ? '·' : ''} {rows.length}
            </span>
            <button
              type="button"
              title="Hide X listens rail"
              aria-label="Hide X listens rail"
              onClick={() => setRailSide('hidden')}
              className="btn-press flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-fg-muted/90">
          Server ingest → rules you saved in Alert Builder · mints link to token.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {rows.length === 0 ? (
          <p className="px-1 py-4 text-center text-[11px] text-fg-muted">
            No X hits yet. Add handles under Co-pilot → Alert Builder.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((r) => {
              const pb = readPayload(r.payload);
              const mint = pb.mint?.trim() ?? null;
              const line = pb.message ?? r.narration ?? 'X alert';
              return (
                <li
                  key={r.id}
                  className="rounded-md border border-border-subtle bg-bg-sunken/60 px-2 py-1.5"
                >
                  <p className="text-[11px] font-medium leading-snug text-fg-primary">{line}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-fg-muted">
                    {pb.handle ? <span>@{pb.handle}</span> : null}
                    {pb.execution === 'auto_buy' ? (
                      <span className="rounded-full bg-accent-primary/12 px-1.5 py-px font-semibold text-accent-primary">
                        auto_buy
                      </span>
                    ) : null}
                    {pb.autoHeldReason ? (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-px text-amber-400">
                        {pb.autoHeldReason}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {mint ? (
                      <Link
                        href={`/token/${encodeURIComponent(mint)}`}
                        className="font-mono text-[10px] text-accent-primary hover:underline"
                      >
                        {shortenAddress(mint, 4)}
                      </Link>
                    ) : null}
                    {pb.tweetUrl ? (
                      <a
                        href={pb.tweetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-fg-muted hover:text-fg-secondary hover:underline"
                      >
                        Open post
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
