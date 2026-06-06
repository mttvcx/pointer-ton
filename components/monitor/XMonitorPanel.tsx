'use client';

import Link from 'next/link';
import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import {
  tweetInputFromAlertPayload,
  type TwitterListenAlertPayload,
} from '@/lib/launch/alertTweet';
import { openDeployForTweet, openDeployForTweetAsync } from '@/lib/launch/openLaunchModal';
import { tweetLaunchCacheSubject } from '@/lib/launch/tweetLaunchSubject';
import type { LaunchPackage, TweetLaunchInput } from '@/lib/launch/types';
import type { AlertsTickerItem } from '@/lib/hooks/useAlertsTicker';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useLaunchPackages } from '@/lib/hooks/useLaunchPackages';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { closeXMonitor } from '@/lib/xMonitor/openXMonitorOnPulse';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { useUIStore } from '@/store/ui';
import { XMonitorRules } from '@/components/monitor/XMonitorRules';

type MonitorTab = 'feed' | 'rules';

type ListenRow = {
  alertId: string;
  createdAt: string;
  tweet: TweetLaunchInput;
  subject: string;
  payload: TwitterListenAlertPayload;
  isMock: boolean;
};

const MOCK_ROWS: ListenRow[] = [
  {
    alertId: 'ux-mock-twitter-1',
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    subject: 'demo-1',
    isMock: true,
    payload: {
      handle: 'elonmusk',
      tweetText: 'Introducing Grok 4.5 — our most capable model yet. Built different.',
      tweetUrl: 'https://x.com/i/web/status/1234567890123456789',
      execution: 'notify',
    },
    tweet: {
      id: '1234567890123456789',
      authorHandle: 'elonmusk',
      text: 'Introducing Grok 4.5 — our most capable model yet. Built different.',
      tweetUrl: 'https://x.com/i/web/status/1234567890123456789',
    },
  },
  {
    alertId: 'ux-mock-twitter-2',
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    subject: 'demo-2',
    isMock: true,
    payload: {
      handle: 'sol_whale_demo',
      tweetText: 'New meta just dropped. $WHALE launching on pump today 🐋',
      tweetUrl: 'https://x.com/i/web/status/9876543210987654321',
      mint: 'So11111111111111111111111111111111111111112',
      execution: 'auto_buy',
      autoHeldReason: 'preview_only',
    },
    tweet: {
      id: '9876543210987654321',
      authorHandle: 'sol_whale_demo',
      text: 'New meta just dropped. $WHALE launching on pump today 🐋',
      tweetUrl: 'https://x.com/i/web/status/9876543210987654321',
    },
  },
  {
    alertId: 'ux-mock-twitter-3',
    createdAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    subject: 'demo-3',
    isMock: true,
    payload: {
      handle: 'kol_demo',
      tweetText: 'This chart is sending it. Someone should tokenize this moment.',
      coverImageUrl: 'https://picsum.photos/seed/pointer-demo-cover/96/96',
      execution: 'notify',
    },
    tweet: {
      authorHandle: 'kol_demo',
      text: 'This chart is sending it. Someone should tokenize this moment.',
      imageUrls: ['https://picsum.photos/seed/pointer-demo-cover/96/96'],
    },
  },
];

function formatListenAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function alertToListenRow(a: AlertsTickerItem): ListenRow | null {
  const tweet = tweetInputFromAlertPayload(a.payload);
  if (!tweet) return null;
  const payload = (a.payload ?? {}) as TwitterListenAlertPayload;
  return {
    alertId: a.id,
    createdAt: a.createdAt,
    tweet,
    subject: tweetLaunchCacheSubject(tweet),
    payload,
    isMock: a.id.startsWith('ux-mock-'),
  };
}

function GripDots() {
  return (
    <div
      className="pointer-events-none grid shrink-0 grid-cols-2 gap-[3px] text-fg-muted opacity-30"
      aria-hidden
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </div>
  );
}

function headerDragAllowed(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !target.closest('button, a, input, textarea, [data-x-monitor-no-drag]');
}

function handleInitial(handle: string): string {
  const h = handle.replace(/^@/, '').trim();
  return (h[0] ?? '?').toUpperCase();
}

function AiLauncherToggle() {
  const launchMode = useAutoLaunchStore((s) => s.launchMode);
  const autoLaunchEnabled = useAutoLaunchStore((s) => s.autoLaunchEnabled);
  const setPrefs = useAutoLaunchStore((s) => s.setPrefs);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2">
      <button
        type="button"
        onClick={() => setPrefs({ launchMode: launchMode === 'ai' ? 'manual' : 'ai' })}
        className={cn(
          'rounded-sm border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition',
          launchMode === 'ai'
            ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
            : 'border-white/[0.08] text-fg-muted hover:text-fg-secondary',
        )}
      >
        AI launcher {launchMode === 'ai' ? 'on' : 'off'}
      </button>
      <button
        type="button"
        onClick={() => setPrefs({ autoLaunchEnabled: !autoLaunchEnabled })}
        className={cn(
          'rounded-sm border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition',
          autoLaunchEnabled
            ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
            : 'border-white/[0.08] text-fg-muted hover:text-fg-secondary',
        )}
      >
        Auto rules {autoLaunchEnabled ? 'on' : 'off'}
      </button>
      <span className="text-[9px] leading-snug text-fg-muted">
        Deploy uses AI when on · rules with auto-launch fire without clicking
      </span>
    </div>
  );
}

export function XMonitorPanel({
  embedded = false,
  dock = 'left',
  defaultTab = 'feed',
  draggable = false,
  floating = false,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
  onClose,
}: {
  embedded?: boolean;
  dock?: 'left' | 'right';
  defaultTab?: MonitorTab;
  /** Show header grabber — drag to float or edge-dock */
  draggable?: boolean;
  /** Rendered inside floating shell (close hides float, not pulse rail) */
  floating?: boolean;
  onDragHandlePointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragHandlePointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragHandlePointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<MonitorTab>(defaultTab);
  const activeChain = useUIStore((s) => s.activeChain);
  const launchMode = useAutoLaunchStore((s) => s.launchMode);
  const { data, isFetching } = useAlertsTickerQuery({ pollAggressively: true });

  const serverRows = useMemo(() => {
    const list = data ?? [];
    return list
      .filter((a) => a.type === ALERT_TYPE_TWITTER_LISTEN)
      .map(alertToListenRow)
      .filter(Boolean) as ListenRow[];
  }, [data]);

  const { rows, mock, banner } = useMemo(() => {
    if (activeChain !== 'sol') {
      return {
        rows: MOCK_ROWS,
        mock: true,
        banner: 'Preview feed · switch to SOL for live X listens.',
      };
    }
    if (serverRows.length === 0) {
      return {
        rows: MOCK_ROWS,
        mock: true,
        banner: 'No live hits yet · showing samples. Add @ rules in Rules tab.',
      };
    }
    return { rows: serverRows, mock: false, banner: null as string | null };
  }, [activeChain, serverRows]);

  const tweets = useMemo(() => rows.map((r) => r.tweet), [rows]);
  const {
    data: packages,
    isFetching: packagesLoading,
    isError: packagesError,
  } = useLaunchPackages(tweets, tweets.length > 0 && activeChain === 'sol');

  const packageBySubject = useMemo(() => {
    const map = new Map<string, LaunchPackage>();
    if (!packages) return map;
    for (const row of packages) {
      map.set(row.subject, row.package);
    }
    return map;
  }, [packages]);

  return (
    <section
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-raised',
        embedded ? 'rounded-none border-0' : 'rounded-lg border border-border-subtle',
      )}
      data-dock={dock}
    >
      <header className="sticky top-0 z-[2] shrink-0 border-b border-white/[0.1] bg-bg-hover shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05)]">
        <div
          className={cn(
            'flex min-w-0 items-center justify-between gap-2 px-3 py-2',
            draggable && 'cursor-grab active:cursor-grabbing',
          )}
          title={draggable ? 'Drag to move · snap to screen edge' : undefined}
          aria-label={draggable ? 'Drag X monitor' : undefined}
          onPointerDown={(e) => {
            if (!draggable || e.button !== 0 || !headerDragAllowed(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            onDragHandlePointerDown?.(e);
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 select-none">
            {draggable ? <GripDots /> : null}
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" aria-hidden />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-primary">
              X monitor
            </h2>
            {mock && tab === 'feed' ? (
              <span className="rounded-sm bg-white/[0.06] px-1.5 py-px text-[9px] font-semibold uppercase text-fg-muted">
                Preview
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5" data-x-monitor-no-drag>
            {tab === 'feed' && packagesLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-muted" aria-hidden />
            ) : null}
            {tab === 'feed' ? (
              <span className="text-[10px] tabular-nums text-fg-muted">{rows.length}</span>
            ) : null}
            <button
              type="button"
              title="Hide X monitor"
              aria-label="Hide X monitor"
              data-x-monitor-no-drag
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onClose?.();
                closeXMonitor();
              }}
              className="btn-press relative z-10 flex h-7 w-7 items-center justify-center rounded-sm border border-border-subtle text-fg-muted transition hover:bg-bg-sunken hover:text-fg-primary"
            >
              <X className="h-3.5 w-3.5 pointer-events-none" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <nav className="flex border-t border-white/[0.06]">
          {(
            [
              ['feed', 'Feed'],
              ['rules', 'Rules'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition',
                tab === id
                  ? 'border-b-2 border-accent-primary text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <AiLauncherToggle />
      </header>

      {tab === 'rules' ? (
        <XMonitorRules />
      ) : (
        <>
          {banner ? (
            <p className="shrink-0 border-b border-white/[0.06] px-3 py-2 text-[10px] leading-snug text-fg-muted">
              {banner}
            </p>
          ) : null}
          {packagesError ? (
            <p className="shrink-0 border-b border-white/[0.06] px-3 py-2 text-[10px] text-fg-muted">
              AI scan offline — Deploy still works with manual fields.
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--app-bottombar-h)+12px)]">            {isFetching && !mock && rows.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-fg-muted">Loading listens…</p>
            ) : null}

            <ul className="divide-y divide-white/[0.06]">
              {rows.map((row) => {
                const pkg = packageBySubject.get(row.subject);
                const mint = row.payload.mint?.trim() ?? null;
                const image = row.tweet.imageUrls?.[0] ?? row.payload.coverImageUrl ?? null;
                const variants = pkg?.shouldLaunch
                  ? (pkg.variants ?? [
                      {
                        suggestedName: pkg.suggestedName,
                        suggestedTicker: pkg.suggestedTicker,
                        narrative: pkg.narrative,
                        suggestedLaunchpad: pkg.suggestedLaunchpad,
                        imageStrategy: pkg.imageStrategy,
                        reasoning: pkg.reasoning,
                      },
                    ])
                  : [];
                const isAutoLaunch =
                  row.payload.requestedExecution === 'auto_launch' ||
                  row.payload.execution === 'auto_launch';

                return (
                  <li
                    key={row.alertId}
                    className={cn(
                      'group px-3 py-2.5 transition-colors hover:bg-white/[0.02]',
                      row.isMock && 'bg-bg-sunken/20',
                    )}
                  >
                    <div className="flex gap-2.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.04] text-[11px] font-semibold text-fg-secondary">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          handleInitial(row.tweet.authorHandle)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span className="truncate text-[12px] font-semibold text-fg-primary">
                                @{(row.tweet.authorHandle ?? 'unknown').replace(/^@/, '')}
                              </span>
                              <span className="text-[10px] tabular-nums text-fg-muted/80">
                                · {formatListenAge(row.createdAt)}
                              </span>
                              {row.payload.execution === 'auto_buy' ? (
                                <span className="rounded-sm bg-white/[0.06] px-1 py-px text-[9px] font-semibold text-fg-muted">
                                  auto_buy
                                </span>
                              ) : null}
                              {isAutoLaunch ? (
                                <span className="rounded-sm bg-accent-primary/12 px-1 py-px text-[9px] font-semibold text-accent-primary">
                                  auto_launch
                                </span>
                              ) : null}
                              {row.isMock ? (
                                <span className="rounded-sm bg-white/[0.06] px-1 py-px text-[9px] text-fg-muted">
                                  sample
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[12px] leading-snug text-fg-primary/95">
                              {row.tweet.text}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (launchMode === 'ai' && !pkg?.shouldLaunch) {
                                void openDeployForTweetAsync(row.subject, row.tweet, true);
                                return;
                              }
                              openDeployForTweet(row.subject, row.tweet, pkg, 0);
                            }}
                            className="btn-press shrink-0 rounded-sm bg-accent-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-fg-inverse hover:bg-accent-glow"
                          >
                            {launchMode === 'ai' ? 'Deploy AI' : 'Deploy'}
                          </button>
                        </div>

                        {mint && !row.isMock ? (
                          <Link
                            href={`/token/${encodeURIComponent(mint)}`}
                            className="mt-1.5 inline-block font-mono text-[10px] text-accent-primary hover:underline"
                          >
                            {shortenAddress(mint, 4)}
                          </Link>
                        ) : null}

                        {pkg?.shouldLaunch ? (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                              <Sparkles className="h-3 w-3 text-accent-primary" aria-hidden />
                              AI · {Math.round(pkg.confidence * 100)}%
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {variants.slice(0, 3).map((v, idx) => {
                                const pad = protocolBrand(v.suggestedLaunchpad);
                                return (
                                  <button
                                    key={`${row.subject}-v${idx}`}
                                    type="button"
                                    onClick={() =>
                                      openDeployForTweet(row.subject, row.tweet, pkg, idx)
                                    }
                                    className="btn-press flex max-w-full items-center gap-1 rounded-sm border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-left transition hover:border-accent-primary/30 hover:bg-accent-primary/10"
                                  >
                                    <ProtocolBrandIcon
                                      protocolId={v.suggestedLaunchpad}
                                      dotClassName="h-3 w-3"
                                    />
                                    <span className="truncate text-[10px] font-semibold text-fg-primary">
                                      ${v.suggestedTicker.replace(/^\$/, '')}
                                    </span>
                                    <span className="truncate text-[9px] text-fg-muted">
                                      {v.suggestedName}
                                    </span>
                                    {pad ? <span className="sr-only">{pad.label}</span> : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : packagesLoading && !mock ? (
                          <p className="mt-2 text-[10px] text-fg-muted/80">Scanning launch potential…</p>
                        ) : null}

                        {row.payload.tweetUrl ? (
                          <a
                            href={row.payload.tweetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-[10px] text-fg-muted hover:text-fg-secondary hover:underline"
                          >
                            View on X
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

/** @deprecated Use XMonitorPanel */
export function PulseLaunchRail(props: {
  dock: 'left' | 'right';
  embedded?: boolean;
}) {
  return <XMonitorPanel {...props} />;
}
