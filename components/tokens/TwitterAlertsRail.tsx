'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { isUiDemoMode } from '@/lib/dev/uiDemoMode';
import type { AlertsTickerItem } from '@/lib/hooks/useAlertsTicker';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useUIStore } from '@/store/ui';

type TweetListenPayload = {
  message?: string;
  ruleName?: string;
  handle?: string;
  tweetUrl?: string | null;
  mint?: string | null;
  execution?: string;
  autoHeldReason?: string | null;
  coverImageUrl?: string | null;
};

function readPayload(p: unknown): TweetListenPayload {
  return p && typeof p === 'object' ? (p as TweetListenPayload) : {};
}

/** UX mocks — same ticker shape as `/api/alerts/ticker` twitter_listen rows. */
const MOCK_TWITTER_ALERTS: AlertsTickerItem[] = [
  {
    id: 'ux-mock-twitter-1',
    type: ALERT_TYPE_TWITTER_LISTEN,
    narration: null,
    createdAt: new Date().toISOString(),
    payload: {
      message: 'Phrase matched · “launching on pump today”',
      handle: 'demo_caller',
      tweetUrl: 'https://x.com/i/web/status/1234567890123456789',
      mint: null,
      execution: 'notify',
    },
  },
  {
    id: 'ux-mock-twitter-2',
    type: ALERT_TYPE_TWITTER_LISTEN,
    narration: null,
    createdAt: new Date().toISOString(),
    payload: {
      message: 'Mint extracted from tweet URL',
      handle: 'sol_whale_demo',
      tweetUrl: 'https://x.com/i/web/status/9876543210987654321',
      mint: 'So11111111111111111111111111111111111111112',
      execution: 'auto_buy',
      autoHeldReason: 'preview_only',
    },
  },
  {
    id: 'ux-mock-twitter-3',
    type: ALERT_TYPE_TWITTER_LISTEN,
    narration: null,
    createdAt: new Date().toISOString(),
    payload: {
      message: 'Handle broadcast · multi-line ingest stub',
      handle: 'kol_demo',
      tweetUrl: null,
      mint: null,
      execution: 'notify',
      coverImageUrl: 'https://picsum.photos/seed/pointer-demo-cover/96/96',
    },
  },
];

export function TwitterAlertsRail({ dock }: { dock: 'left' | 'right' }) {
  const activeChain = useUIStore((s) => s.activeChain);
  const { data, isFetching } = useAlertsTickerQuery({ pollAggressively: false });
  const setRailSide = usePulseTwitterRailStore((s) => s.setSide);

  const serverRows = useMemo(() => {
    const list = data ?? [];
    return list.filter((a) => a.type === ALERT_TYPE_TWITTER_LISTEN);
  }, [data]);

  const uiDemo = isUiDemoMode();
  const { rows, banner, mock } = useMemo(() => {
    if (activeChain !== 'sol') {
      return {
        rows: uiDemo ? MOCK_TWITTER_ALERTS : [],
        banner: 'Live X listens are wired for Solana — switch chain to SOL for real hits.',
        mock: uiDemo,
      };
    }
    if (serverRows.length === 0) {
      /** Live mode: honest empty state — sample rows only in explicit demo mode. */
      return {
        rows: uiDemo ? MOCK_TWITTER_ALERTS : [],
        banner: uiDemo
          ? 'No live X listens yet · showing samples. Create rules under Co-pilot → Alert Builder → X listens.'
          : 'No live X listens yet. Create rules under Co-pilot → Alert Builder → X listens.',
        mock: uiDemo,
      };
    }
    return { rows: serverRows, banner: null as string | null, mock: false };
  }, [activeChain, serverRows, uiDemo]);

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
            {mock ? (
              <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-amber-200/95">
                Preview
              </span>
            ) : null}
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-fg-muted">
              {isFetching && !mock ? '· ' : ''}
              {rows.length}
              {mock ? <span className="sr-only">mock rows</span> : null}
            </span>
            <CloseButton
              title="Hide X listens rail"
              label="Hide X listens rail"
              size="sm"
              onClick={() => setRailSide('hidden')}
            />
          </div>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-fg-muted/90">
          Server ingest → rules you saved in Alert Builder · mints link to token.
        </p>
        {banner ? (
          <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-1.5 text-[9px] leading-snug text-amber-100/90">
            {banner}
          </p>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {rows.map((r) => {
            const pb = readPayload(r.payload);
            const mint = pb.mint?.trim() ?? null;
            const line = pb.message ?? r.narration ?? 'X alert';
            const isMockRow = r.id.startsWith('ux-mock-');
            return (
              <li
                key={r.id}
                className={cn(
                  'rounded-md border border-border-subtle px-2 py-1.5',
                  isMockRow ? 'border-dashed bg-bg-sunken/40' : 'bg-bg-sunken/60',
                )}
              >
                <div className="flex gap-2">
                  {pb.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote tweet CDN URLs from ingest / mocks
                    <img
                      src={pb.coverImageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="mt-0.5 h-11 w-11 shrink-0 rounded-md border border-border-subtle bg-bg-hover object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-snug text-fg-primary">{line}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-fg-muted">
                      {pb.handle ? <span>@{pb.handle}</span> : null}
                      {pb.execution === 'auto_buy' ? (
                        <span className="rounded-full bg-accent-primary/12 px-1.5 py-px font-semibold text-accent-primary">
                          auto_buy
                        </span>
                      ) : null}
                      {pb.autoHeldReason ? (
                        <span className="rounded-full bg-amber-500/10 px-1.5 py-px text-amber-400">{pb.autoHeldReason}</span>
                      ) : null}
                      {isMockRow ? (
                        <span className="rounded-full bg-fg-muted/10 px-1.5 py-px font-semibold text-fg-muted">mock</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {mint && !isMockRow ? (
                        <Link
                          href={`/token/${encodeURIComponent(mint)}`}
                          className="font-mono text-[10px] text-accent-primary hover:underline"
                        >
                          {shortenAddress(mint, 4)}
                        </Link>
                      ) : mint && isMockRow ? (
                        <span className="font-mono text-[10px] text-fg-muted" title="Sample mint in preview">
                          {shortenAddress(mint, 4)} (sample)
                        </span>
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
