'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, BadgeCheck, Loader2, MessageCircle, Quote, Repeat2, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { isUiDemoMode } from '@/lib/dev/uiDemoMode';
import {
  makeDemoStreamRow,
  seedDemoStream,
  type DemoEvent,
  type DemoPlatform,
  type DemoStreamFields,
} from '@/lib/dev/xMonitorDemoStream';
import {
  tweetInputFromAlertPayload,
  type TwitterListenAlertPayload,
} from '@/lib/launch/alertTweet';
import { openDeployForTweet, openDeployForTweetAsync, openLaunchFromSuggestion } from '@/lib/launch/openLaunchModal';
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
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';
import { useXMonitorSettings } from '@/store/xMonitorSettings';
import { XMonitorRules } from '@/components/monitor/XMonitorRules';
import { XMonitorSettings } from '@/components/monitor/XMonitorSettings';
import { TweetMediaImage } from '@/components/monitor/TweetMediaImage';
import { HoverZoomImage } from '@/components/monitor/HoverZoomImage';

type MonitorTab = 'feed' | 'rules' | 'settings';

type ListenRow = {
  alertId: string;
  createdAt: string;
  tweet: TweetLaunchInput;
  subject: string;
  payload: TwitterListenAlertPayload;
  isMock: boolean;
} & Partial<DemoStreamFields>;

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

const PLATFORM_LABEL: Record<DemoPlatform, string> = {
  x: 'X',
  truth: 'Truth Social',
  instagram: 'Instagram',
};

/** J7-style event line: "replied to @x" / "posted on Truth Social" / "followed @x". */
function eventLine(row: ListenRow): { verb: string; target: string | null } | null {
  if (!row.eventType) return null;
  const target = row.targetHandle ? `@${row.targetHandle}` : null;
  switch (row.eventType) {
    case 'posted':
      return { verb: row.platform && row.platform !== 'x' ? `posted on ${PLATFORM_LABEL[row.platform]}` : 'posted', target: null };
    case 'replied':
      return { verb: 'replied to', target };
    case 'quoted':
      return { verb: 'quoted', target };
    case 'retweeted':
      return { verb: 'retweeted', target };
    case 'followed':
      return { verb: 'followed', target };
    case 'deleted':
      return { verb: 'deleted a post', target: null };
    default:
      return null;
  }
}

function EventIcon({ type }: { type: DemoEvent }) {
  const cls = 'h-3 w-3 shrink-0';
  if (type === 'replied') return <MessageCircle className={cls} strokeWidth={2} aria-hidden />;
  if (type === 'quoted') return <Quote className={cls} strokeWidth={2} aria-hidden />;
  if (type === 'retweeted') return <Repeat2 className={cls} strokeWidth={2} aria-hidden />;
  if (type === 'followed') return <UserPlus className={cls} strokeWidth={2} aria-hidden />;
  if (type === 'deleted') return <Trash2 className={cls} strokeWidth={2} aria-hidden />;
  return <ArrowUpRight className={cls} strokeWidth={2} aria-hidden />;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Avatar with graceful fallback to the handle initial if the image fails. */
function Avatar({ url, handle, size = 28 }: { url?: string; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-[11px] font-bold text-fg-secondary"
        style={{ width: size, height: size }}
      >
        {handleInitial(handle)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** Real brand marks for the source platform (X / Instagram / Truth Social). */
function PlatformBadge({ platform }: { platform: DemoPlatform }) {
  if (platform === 'x') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-fg-secondary" fill="currentColor" aria-label="X">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-pink-400" fill="none" stroke="currentColor" strokeWidth={2} aria-label="Instagram">
        <rect x="2" y="2" width="20" height="20" rx="5.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[#5448ee] text-[8px] font-black leading-none text-white"
      aria-label="Truth Social"
    >
      T
    </span>
  );
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
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
      <button
        type="button"
        onClick={() => setPrefs({ launchMode: launchMode === 'ai' ? 'manual' : 'ai' })}
        className={cn(
          'btn-press rounded-md border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide transition-colors',
          launchMode === 'ai'
            ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
            : 'border-white/[0.08] text-fg-muted hover:border-accent-primary/40 hover:bg-accent-primary/[0.08] hover:text-accent-primary',
        )}
      >
        AI launcher {launchMode === 'ai' ? 'on' : 'off'}
      </button>
      <button
        type="button"
        onClick={() => setPrefs({ autoLaunchEnabled: !autoLaunchEnabled })}
        className={cn(
          'btn-press rounded-md border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide transition-colors',
          autoLaunchEnabled
            ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
            : 'border-white/[0.08] text-fg-muted hover:border-accent-primary/40 hover:bg-accent-primary/[0.08] hover:text-accent-primary',
        )}
      >
        Auto rules {autoLaunchEnabled ? 'on' : 'off'}
      </button>
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
  const { data, isFetching } = useAlertsTickerQuery({ pollAggressively: false });

  // Operator settings (persisted) — drive filtering + launch-rail appearance.
  const sources = useXMonitorSettings((s) => s.sources);
  const mutedKeywords = useXMonitorSettings((s) => s.mutedKeywords);
  const whitelistHandles = useXMonitorSettings((s) => s.whitelistHandles);
  const keywordHighlights = useXMonitorSettings((s) => s.keywordHighlights);
  const aiSuggestionsEnabled = useXMonitorSettings((s) => s.aiSuggestionsEnabled);
  const aiSuggestionCount = useXMonitorSettings((s) => s.aiSuggestionCount);
  const launchRailSide = useXMonitorSettings((s) => s.launchRailSide);
  const launchRailStyle = useXMonitorSettings((s) => s.launchRailStyle);
  const launchRailColor = useXMonitorSettings((s) => s.launchRailColor);
  const launchRailSize = useXMonitorSettings((s) => s.launchRailSize);
  const keybinds = useXMonitorSettings((s) => s.keybinds);

  // Keybinds + dismiss: track the hovered card and locally-dismissed rows.
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const serverRows = useMemo(() => {
    const list = data ?? [];
    return list
      .filter((a) => a.type === ALERT_TYPE_TWITTER_LISTEN)
      .map(alertToListenRow)
      .filter(Boolean) as ListenRow[];
  }, [data]);

  const uiDemo = isUiDemoMode();
  // Preview toggle now lives beside the Pulse/Stocks tabs (shared store), so the
  // panel header stays clean. Client-side demo only.
  const localSamples = useXMonitorPreviewStore((s) => s.preview);
  const showDemo = uiDemo || localSamples;

  // Streaming preview: while demo is on, fake events arrive on an interval so the
  // operator can watch real feed behavior (new cards prepend, pause-on-hover,
  // suggestions). Never runs for live data — real events flow via serverRows.
  const [streamRows, setStreamRows] = useState<ListenRow[]>([]);
  const seqRef = useRef(1000);
  // Pause the incoming stream while the operator hovers the feed (like the
  // wallet tracker) so cards don't jump under the cursor.
  const [feedHovered, setFeedHovered] = useState(false);
  const feedHoveredRef = useRef(false);
  useEffect(() => {
    feedHoveredRef.current = feedHovered;
  }, [feedHovered]);
  useEffect(() => {
    if (!showDemo || activeChain !== 'sol') {
      setStreamRows([]);
      return;
    }
    setStreamRows(seedDemoStream(Date.now()));
    const id = window.setInterval(() => {
      if (feedHoveredRef.current) return; // paused on hover
      setStreamRows((prev) => {
        const seq = seqRef.current++;
        return [makeDemoStreamRow(seq, seq, Date.now()), ...prev].slice(0, 30);
      });
    }, 5500);
    return () => window.clearInterval(id);
  }, [showDemo, activeChain]);

  const { rows: allRows, mock, banner } = useMemo(() => {
    if (activeChain !== 'sol') {
      return {
        rows: showDemo ? streamRows : [],
        mock: showDemo,
        banner: 'Live X listens are Solana-only — switch chain to SOL.',
      };
    }
    if (serverRows.length === 0) {
      /** Live mode: honest empty feed — samples only when explicitly previewed. */
      return {
        rows: showDemo ? streamRows : [],
        mock: showDemo,
        banner: showDemo ? null : 'No live hits yet. Add @ rules in the Rules tab to start monitoring.',
      };
    }
    return { rows: serverRows, mock: false, banner: null as string | null };
  }, [activeChain, serverRows, showDemo, streamRows]);

  // Apply operator filters: source channels, muted keywords, whitelist.
  const rows = useMemo(() => {
    const wl = whitelistHandles.map((h) => h.toLowerCase());
    const muted = mutedKeywords.map((m) => m.toLowerCase()).filter(Boolean);
    return allRows.filter((row) => {
      const platform = (row.platform ?? 'x') as DemoPlatform;
      if (platform === 'x' && !sources.x) return false;
      if (platform === 'instagram' && !sources.instagram) return false;
      if (platform === 'truth' && !sources.truth) return false;
      const handle = (row.tweet.authorHandle ?? '').replace(/^@/, '').toLowerCase();
      if (wl.length && !wl.includes(handle)) return false;
      if (muted.length) {
        const text = (row.tweet.text ?? '').toLowerCase();
        if (muted.some((m) => text.includes(m))) return false;
      }
      return true;
    });
  }, [allRows, sources, whitelistHandles, mutedKeywords]);

  const tweets = useMemo(() => rows.map((r) => r.tweet), [rows]);
  const {
    data: packages,
    isFetching: packagesLoading,
    isError: packagesError,
  } = useLaunchPackages(tweets, tweets.length > 0 && activeChain === 'sol' && !mock);

  const packageBySubject = useMemo(() => {
    const map = new Map<string, LaunchPackage>();
    if (!packages) return map;
    for (const row of packages) {
      map.set(row.subject, row.package);
    }
    return map;
  }, [packages]);

  // Locally-dismissed rows drop out of the feed (keybind / future swipe).
  const visibleRows = useMemo(
    () => rows.filter((r) => !dismissedIds.has(r.alertId)),
    [rows, dismissedIds],
  );

  const runLaunch = (row: ListenRow) => {
    const pkg = packageBySubject.get(row.subject);
    if (row.isMock) {
      openDeployForTweet(row.subject, row.tweet, null);
      return;
    }
    if (launchMode === 'ai' && !pkg?.shouldLaunch) {
      void openDeployForTweetAsync(row.subject, row.tweet, true);
      return;
    }
    openDeployForTweet(row.subject, row.tweet, pkg, 0);
  };

  // Single-key shortcuts act on the hovered card (deploy / dismiss).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hoveredRowId) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      const row = visibleRows.find((r) => r.alertId === hoveredRowId);
      if (!row) return;
      const k = e.key.toLowerCase();
      if (k === keybinds.deploy) {
        e.preventDefault();
        runLaunch(row);
      } else if (k === keybinds.dismiss) {
        e.preventDefault();
        setDismissedIds((prev) => new Set(prev).add(row.alertId));
        setHoveredRowId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredRowId, visibleRows, keybinds, launchMode, packageBySubject]);

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
            'flex min-w-0 items-center justify-between gap-2 px-3 py-2 transition-colors',
            draggable && 'cursor-grab hover:bg-white/[0.05] active:cursor-grabbing active:bg-white/[0.08]',
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
          </div>
          <div className="flex shrink-0 items-center gap-1.5" data-x-monitor-no-drag>
            {tab === 'feed' && packagesLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-muted" aria-hidden />
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
              className="btn-press group/close relative z-10 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-signal-bear/15 hover:text-signal-bear"
            >
              <X className="pointer-events-none h-4 w-4 transition-transform group-hover/close:rotate-90" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
        <nav className="flex border-t border-white/[0.06]">
          {(
            [
              ['feed', 'Feed'],
              ['rules', 'Rules'],
              ['settings', 'Settings'],
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

        {tab === 'feed' ? <AiLauncherToggle /> : null}
      </header>

      {tab === 'rules' ? (
        <XMonitorRules />
      ) : tab === 'settings' ? (
        <XMonitorSettings />
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

          <div
            onMouseEnter={() => setFeedHovered(true)}
            onMouseLeave={() => setFeedHovered(false)}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--app-bottombar-h)+12px)] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
          >
            {showDemo && feedHovered ? (
              <div className="pointer-events-none sticky top-1 z-[3] flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)] backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                  Paused — hovering
                </span>
              </div>
            ) : null}
            {isFetching && !mock && rows.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-fg-muted">Loading listens…</p>
            ) : null}

            <ul className="flex flex-col gap-1.5 p-1.5">
              {visibleRows.map((row) => {
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
                const isDeleted = row.eventType === 'deleted';
                const ev = eventLine(row);
                const isHighlighted =
                  keywordHighlights.length > 0 &&
                  keywordHighlights.some((k) =>
                    (row.tweet.text ?? '').toLowerCase().includes(k.toLowerCase()),
                  );
                const isVertRail = launchRailSide === 'left' || launchRailSide === 'right';
                const railThickness = launchRailSize === 'big'
                  ? isVertRail
                    ? 'w-11'
                    : 'h-11'
                  : isVertRail
                    ? 'w-8'
                    : 'h-8';
                const railMargin =
                  launchRailSide === 'left'
                    ? 'my-2 ml-2'
                    : launchRailSide === 'right'
                      ? 'my-2 mr-2'
                      : launchRailSide === 'top'
                        ? 'mx-2 mt-2'
                        : 'mx-2 mb-2';
                // Custom colour drives a --rail CSS var; hover fill/outline is done
                // with color-mix arbitrary classes so it reacts like the default accent.
                const railStyle: CSSProperties | undefined = launchRailColor
                  ? ({ ['--rail']: launchRailColor, color: launchRailColor } as CSSProperties)
                  : undefined;

                return (
                  <li
                    key={row.alertId}
                    onMouseEnter={() => setHoveredRowId(row.alertId)}
                    onMouseLeave={() => setHoveredRowId((cur) => (cur === row.alertId ? null : cur))}
                    className={cn(
                      // Carded grey rows (J7-style premium) — lighter grey for legibility.
                      'group flex items-stretch gap-0 overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.055] transition-colors hover:border-white/[0.16] hover:bg-white/[0.08]',
                      launchRailSide === 'right' && 'flex-row-reverse',
                      launchRailSide === 'top' && 'flex-col',
                      launchRailSide === 'bottom' && 'flex-col-reverse',
                      // Deleted events read red + striped; platform accent otherwise.
                      isDeleted && 'border-signal-bear/25 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.09)_0_10px,rgba(255,255,255,0.05)_10px_20px)]',
                      row.platform === 'truth' && !isDeleted && 'bg-sky-500/[0.07]',
                      row.platform === 'instagram' && !isDeleted && 'bg-pink-500/[0.07]',
                      isHighlighted && 'border-accent-primary/40 bg-accent-primary/[0.06] hover:border-accent-primary/55',
                    )}
                  >
                    {/* Left vertical LAUNCH rail — same borderless accent-fill look
                        as the Pulse quick-buy pill (no clashing outline). */}
                    <button
                      type="button"
                      onClick={() => runLaunch(row)}
                      title={
                        row.isMock
                          ? 'Sample preview — launch is disabled on demo data'
                          : isAutoLaunch
                            ? 'Auto-launch armed for this rule'
                            : 'Launch a token from this tweet'
                      }
                      style={railStyle}
                      className={cn(
                        'btn-press focus-ring flex shrink-0 cursor-pointer items-center justify-center rounded-md font-sans transition-colors',
                        railThickness,
                        railMargin,
                        // Default accent
                        !launchRailColor && launchRailStyle === 'fill' && (isAutoLaunch
                          ? 'bg-accent-primary/25 text-accent-primary hover:bg-accent-primary/[0.32]'
                          : 'bg-accent-primary/[0.12] text-accent-primary hover:bg-accent-primary/20'),
                        !launchRailColor && launchRailStyle === 'outline' &&
                          'border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/[0.12]',
                        // Custom colour — fill (deepens on hover) via color-mix
                        launchRailColor && launchRailStyle === 'fill' && !isAutoLaunch &&
                          '[background:color-mix(in_srgb,var(--rail)_16%,transparent)] hover:[background:color-mix(in_srgb,var(--rail)_26%,transparent)]',
                        launchRailColor && launchRailStyle === 'fill' && isAutoLaunch &&
                          '[background:color-mix(in_srgb,var(--rail)_28%,transparent)] hover:[background:color-mix(in_srgb,var(--rail)_38%,transparent)]',
                        // Custom colour — outline (fills a little on hover)
                        launchRailColor && launchRailStyle === 'outline' &&
                          'border [border-color:color-mix(in_srgb,var(--rail)_55%,transparent)] hover:[background:color-mix(in_srgb,var(--rail)_14%,transparent)]',
                      )}
                    >
                      <span
                        className={cn(
                          'font-semibold uppercase tracking-wide',
                          launchRailSize === 'big' ? 'text-[11px]' : 'text-[9.5px]',
                          isVertRail && 'rotate-180 [writing-mode:vertical-rl]',
                        )}
                      >
                        {isAutoLaunch ? 'Auto' : launchMode === 'ai' ? 'AI Launch' : 'Launch'}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <a
                          href={`https://x.com/${(row.tweet.authorHandle ?? '').replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0"
                        >
                          <Avatar url={row.avatarUrl} handle={row.tweet.authorHandle ?? ''} size={28} />
                        </a>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://x.com/${(row.tweet.authorHandle ?? '').replace(/^@/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-[12px] font-semibold text-fg-primary hover:underline"
                            >
                              {row.displayName ?? `@${(row.tweet.authorHandle ?? 'unknown').replace(/^@/, '')}`}
                            </a>
                            {row.verified ? (
                              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" strokeWidth={2} aria-hidden />
                            ) : null}
                            {row.platform ? <PlatformBadge platform={row.platform} /> : null}
                            <span className="shrink-0 text-[10px] tabular-nums text-fg-muted/80">
                              · {formatListenAge(row.createdAt)}
                            </span>
                            {hoveredRowId === row.alertId ? (
                              <span className="ml-auto hidden shrink-0 items-center gap-1 text-[8.5px] font-semibold uppercase tracking-wide text-fg-muted/70 sm:inline-flex">
                                <kbd className="rounded bg-white/[0.08] px-1 py-px">{keybinds.deploy}</kbd>
                                deploy
                                <kbd className="ml-0.5 rounded bg-white/[0.08] px-1 py-px">{keybinds.dismiss}</kbd>
                                hide
                              </span>
                            ) : null}
                          </div>
                          {row.displayName ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-fg-muted">
                              <a
                                href={`https://x.com/${(row.tweet.authorHandle ?? '').replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate hover:underline"
                              >
                                @{(row.tweet.authorHandle ?? 'unknown').replace(/^@/, '')}
                              </a>
                              {row.followers ? (
                                <span className="shrink-0 tabular-nums">· {fmtCount(row.followers)} followers</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {row.payload.execution === 'auto_buy' ? (
                          <span className="shrink-0 self-start rounded-sm bg-white/[0.06] px-1 py-px text-[9px] font-semibold text-fg-muted">
                            auto_buy
                          </span>
                        ) : null}
                        {isAutoLaunch ? (
                          <span className="shrink-0 self-start rounded-sm bg-accent-primary/12 px-1 py-px text-[9px] font-semibold text-accent-primary">
                            auto_launch
                          </span>
                        ) : null}
                      </div>

                      {ev ? (
                        <a
                          href={row.payload.tweetUrl ?? `https://x.com/${(row.tweet.authorHandle ?? '').replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            'mt-1 flex items-center gap-1 text-[11.5px] transition-colors hover:underline',
                            isDeleted ? 'text-signal-bear' : 'text-white',
                          )}
                        >
                          {row.eventType ? <EventIcon type={row.eventType} /> : null}
                          <span className="truncate">
                            <span className="font-medium">@{(row.tweet.authorHandle ?? '').replace(/^@/, '')}</span>{' '}
                            <span className="text-white/70">{ev.verb}</span>
                            {ev.target ? <span className="text-accent-primary"> {ev.target}</span> : null}
                          </span>
                        </a>
                      ) : null}

                      {row.tweet.text ? (
                        <p
                          className={cn(
                            'mt-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] leading-relaxed',
                            isDeleted
                              ? 'text-white/50 line-through decoration-signal-bear/50'
                              : 'text-white',
                          )}
                        >
                          {row.tweet.text}
                        </p>
                      ) : null}

                      {row.quoted ? (
                        <a
                          href={`https://x.com/${row.quoted.handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 block rounded-md border-l-2 border-white/[0.12] bg-white/[0.02] px-2.5 py-1.5 transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <Avatar url={row.quoted.avatarUrl} handle={row.quoted.handle} size={14} />
                            <span className="font-semibold text-fg-secondary">{row.quoted.name}</span>
                            <span className="text-fg-muted">@{row.quoted.handle}</span>
                          </div>
                          <p className="mt-0.5 break-words [overflow-wrap:anywhere] text-[12px] leading-relaxed text-white/85">{row.quoted.text}</p>
                        </a>
                      ) : null}

                      {image ? <TweetMediaImage src={image} /> : null}

                      {mint && !row.isMock ? (
                        <Link
                          href={`/token/${encodeURIComponent(mint)}`}
                          className="mt-1.5 inline-block font-mono text-[10px] text-accent-primary hover:underline"
                        >
                          {shortenAddress(mint, 4)}
                        </Link>
                      ) : null}

                      {aiSuggestionsEnabled && row.suggestions?.length ? (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                            <Sparkles className="h-3 w-3 text-accent-primary" aria-hidden />
                            Suggestions
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.suggestions.slice(0, aiSuggestionCount).map((s, i) => (
                              <div
                                key={`${row.subject}-s${i}`}
                                className="flex items-stretch overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.05] transition-colors hover:border-white/[0.18]"
                              >
                                {s.image ? (
                                  <HoverZoomImage src={s.image} className="h-12 w-12 shrink-0" previewW={240} />
                                ) : (
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-white/[0.04] text-[12px] font-bold text-fg-secondary">
                                    {s.ticker.replace(/^\$/, '').slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 px-2.5 py-1.5">
                                  <div className="truncate text-[12px] font-semibold text-white">{s.name}</div>
                                  <div className="truncate text-[11px] text-fg-muted">${s.ticker.replace(/^\$/, '')}</div>
                                </div>
                                <div className="flex flex-col border-l border-white/[0.1]">
                                  <button
                                    type="button"
                                    title="Edit and focus name"
                                    onClick={() => openLaunchFromSuggestion(row.subject, row.tweet, s, 'name')}
                                    className="flex flex-1 items-center justify-center px-2.5 text-[11px] font-bold text-fg-muted transition-colors hover:bg-accent-primary/20 hover:text-accent-primary"
                                  >
                                    N
                                  </button>
                                  <button
                                    type="button"
                                    title="Edit and focus ticker"
                                    onClick={() => openLaunchFromSuggestion(row.subject, row.tweet, s, 'ticker')}
                                    className="flex flex-1 items-center justify-center border-t border-white/[0.1] px-2.5 text-[11px] font-bold text-fg-muted transition-colors hover:bg-accent-primary/20 hover:text-accent-primary"
                                  >
                                    T
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : pkg?.shouldLaunch ? (
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
                                  onClick={() => openDeployForTweet(row.subject, row.tweet, pkg, idx)}
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
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-white transition-colors hover:text-accent-primary hover:underline"
                        >
                          View on X <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
                        </a>
                      ) : null}
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
