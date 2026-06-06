'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Calendar,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Lock,
  MapPin,
  Search,
  Shield,
  User,
  Wallet,
} from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import {
  formatAgeShort,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from '@/lib/utils/formatters';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import type { PulseTokenBundle } from '@/types/tokens';
import { approxTweetCreatedAtMs, type PulseSocialModel } from '@/lib/tokens/pulseSocialLinks';
import { agentBuybackPctFromMetadata } from '@/lib/tokens/pulseRichMetadata';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useTwitterProfile } from '@/lib/hooks/useTwitterProfile';

function isTwitterishUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return h === 'x.com' || h === 'twitter.com';
  } catch {
    return false;
  }
}

/** Axiom-style dense hover card; use `pointer-events-auto` on interactive panels. */
export function PulseRichHover({
  children,
  panel,
  wide,
  /** When true, the outer wrapper has no chrome (no bg / border / shadow / fixed width).
   *  Use this when the inner `panel` brings its own container styling, like `DevFundedHoverPanel`. */
  bare,
}: {
  children: ReactNode;
  panel: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setEntered(true);
  }, [open]);

  return (
    <span
      className="relative isolate inline-flex"
      /**
       * Marked while the popover is open. Ancestors (e.g. the Pulse virtual slot in
       * `PulseColumn`) use `:has([data-popover-open])` to lift their z-index so the
       * popover paints above neighboring rows even when the cursor leaves the slot's
       * visual box to travel down into the popup body.
       */
      data-popover-open={open ? 'true' : undefined}
    >
      <span
        className="inline-flex"
        onMouseEnter={() => {
          clear();
          t.current = setTimeout(() => setOpen(true), 40);
        }}
        onMouseLeave={() => {
          clear();
          t.current = setTimeout(() => setOpen(false), 80);
        }}
      >
        {children}
      </span>
      {open ? (
        <div
          className={cn(
            'pointer-events-auto absolute left-1/2 top-[calc(100%+10px)] z-[260] max-h-[min(72vh,30rem)] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 overflow-y-auto overflow-x-hidden',
            'transition-opacity duration-75 ease-out motion-reduce:transition-none motion-reduce:opacity-100',
            entered ? 'opacity-100' : 'opacity-0',
            bare
              ? null
              : 'rounded-xl border border-border-subtle bg-bg-raised shadow-panel',
            bare ? null : wide ? 'w-[19.5rem]' : 'w-[17.25rem]',
          )}
          onMouseEnter={() => {
            clear();
            setOpen(true);
          }}
          onMouseLeave={() => {
            clear();
            t.current = setTimeout(() => setOpen(false), 80);
          }}
          role="dialog"
          aria-label="Details"
        >
          {panel}
        </div>
      ) : null}
    </span>
  );
}

const labelMuted = 'text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]';

/** Opaque micro-hover shell — no backdrop blur (Axiom parity). */
export const pulseCompactPanelCn = cn(
  'rounded-lg border border-border-subtle bg-bg-raised px-2.5 py-2 shadow-panel',
);

/** Shared Axiom-ish micro-card shell (above trigger). Used by Pulse strip hovers + globe URL card. */
export const pulseCompactAbovePanelCn = cn(
  'absolute left-1/2 z-[260] w-max max-w-[min(17.5rem,calc(100vw-2rem))] -translate-x-1/2',
  pulseCompactPanelCn,
);

const pulseCompactBelowPanelCn = cn(
  pulseCompactAbovePanelCn,
  'top-[calc(100%+6px)] bottom-auto',
);

const pulseCompactAboveOnlyPanelCn = cn(
  pulseCompactAbovePanelCn,
  'bottom-[calc(100%+6px)]',
);

/** Small dense hover card — defaults above trigger; use `placement="below"` under token header icons. */
export function PulseCompactHoverAbove({
  children,
  content,
  openDelayMs = 120,
  closeDelayMs = 120,
  role = 'tooltip',
  placement = 'above',
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  openDelayMs?: number;
  closeDelayMs?: number;
  role?: 'tooltip' | 'status';
  placement?: 'above' | 'below';
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => clear(), []);

  const syncPanelPos = () => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    setPanelPos({
      top: placement === 'below' ? r.bottom + 6 : r.top - 6,
      left: r.left + r.width / 2,
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPanelPos(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const scheduleOpen = () => {
    clear();
    timer.current = setTimeout(() => {
      syncPanelPos();
      setOpen(true);
    }, openDelayMs);
  };
  const scheduleClose = () => {
    clear();
    timer.current = setTimeout(() => {
      setOpen(false);
      setPanelPos(null);
    }, closeDelayMs);
  };

  const panel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={cn(
              'pointer-events-auto fixed z-[260] w-max max-w-[min(17.5rem,calc(100vw-2rem))]',
              pulseCompactPanelCn,
              placement === 'below' ? '-translate-x-1/2' : '-translate-x-1/2 -translate-y-full',
            )}
            style={{ top: panelPos.top, left: panelPos.left }}
            role={role}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
          >
            {content}
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex"
      data-popover-open={open ? 'true' : undefined}
    >
      <span className="inline-flex" onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
        {children}
      </span>
      {panel}
    </span>
  );
}

export function PulseCashbackCompactHover({ children }: { children: React.ReactNode }) {
  return (
    <PulseCompactHoverAbove
      content={
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold leading-none text-white/95">Cashback</p>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide leading-none text-signal-bull/80">
              On
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-white/50">
            Pump.fun metadata flags a rebate / cashback program for this mint.
          </p>
        </>
      }
    >
      {children}
    </PulseCompactHoverAbove>
  );
}

export function TwitterProfileHoverPanel({
  bundle,
  model,
  followers,
}: {
  bundle: PulseTokenBundle;
  model: PulseSocialModel;
  followers: number | null;
}) {
  const { token } = bundle;
  const profile = model.twitterProfile;
  if (!profile?.url) return null;

  const handle = profile.handle?.replace(/^@/, '') ?? '';
  const bio =
    typeof token.description === 'string' && token.description.trim()
      ? token.description.trim()
      : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl">
      <div className="relative h-12 w-full overflow-hidden bg-gradient-to-b from-[#1a2332]/90 to-[#0d1117]">
        <TokenImage
          src={token.image_url}
          alt=""
          size={400}
          className="!h-12 !w-full !rounded-none !object-cover opacity-[0.22] brightness-[0.45]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1419] via-transparent to-transparent" />
        <span
          className="absolute right-2.5 top-2 text-[13px] font-bold leading-none text-white/90"
          aria-hidden
        >
          𝕏
        </span>
      </div>
      <div className="relative -mt-4 flex flex-col gap-2 px-3 pb-3 pt-0">
        <div className="flex items-end gap-2">
          <TokenImage
            src={token.image_url}
            alt={token.symbol ?? ''}
            size={48}
            className="!rounded-full ring-2 ring-[#15202b]"
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate text-[13px] font-semibold text-white">{token.name ?? '-'}</p>
            <p className="text-[11px] text-white/45">@{handle || 'profile'}</p>
          </div>
        </div>
        {bio ? (
          <p className="line-clamp-4 text-[11px] leading-snug text-white/72">{bio}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/90">
          <span>
            <span className="text-white/40">Followers </span>
            <span className="font-semibold tabular-nums text-[#7dd3fc]">
              {followers != null && followers > 0
                ? formatNumber(followers, { compact: true })
                : '-'}
            </span>
          </span>
        </div>
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2 text-center text-[12px] font-semibold text-[#7dd3fc] transition hover:border-[#7dd3fc]/35 hover:bg-[#7dd3fc]/[0.08]"
        >
          See profile on X
        </a>
      </div>
    </div>
  );
}

/* ───────────────────────── Twitter profile HoverCard ─────────────────────── */

function formatFollowers(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return String(Math.round(n));
}

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Square X glyph rendered inline (no extra dep — lucide doesn't ship an X logo). */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn('h-3.5 w-3.5', className)}
    >
      <path
        d="M11.6 2.5h2.1L9.1 7.78l5.4 5.72H10.4l-3.3-3.96L3.3 13.5H1.2l4.95-5.66L1 2.5h4.2l3 3.62L11.6 2.5zm-.36 9.6h1.16L4.85 3.8H3.6l7.64 8.3z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * IMPORTANT: keep this in sync with the avatar `ring-[#0a0a0a]` ring color —
 * the ring punches the avatar visually out of the banner edge, and any drift
 * between the two creates a visible seam at the panel boundary.
 */
const TWITTER_PROFILE_HOVER_PANEL_BG = '#0a0a0a';

/** Mini-profile preview surface — banner + avatar + identity + meta + stats + CTA. */
export function TwitterProfileHoverCard({ handle }: { handle: string }) {
  const profileHandle = handle.replace(/^@/, '').trim();
  const { data, isLoading, isError } = useTwitterProfile(profileHandle);

  if (isLoading && !data) return <TwitterProfileHoverSkeleton />;
  if (isError && !data) return <TwitterProfileHoverEmpty handle={profileHandle} />;
  if (!data) return <TwitterProfileHoverSkeleton />;
  return <TwitterProfileHoverBody data={data} />;
}

function TwitterProfileHoverShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-[300px] overflow-hidden rounded-xl border border-white/[0.06] shadow-2xl shadow-black/60"
      style={{ backgroundColor: TWITTER_PROFILE_HOVER_PANEL_BG }}
    >
      {children}
    </div>
  );
}

function TwitterProfileBanner({
  bannerUrl,
  profileUrl,
}: {
  bannerUrl: string | null;
  profileUrl: string;
}) {
  return (
    <div
      className={cn(
        'relative h-[96px] w-full bg-cover bg-center',
        !bannerUrl && 'bg-gradient-to-br from-indigo-500/40 to-purple-500/40',
      )}
      style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
    >
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open on X"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        <XGlyph className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function TwitterProfileHoverBody({
  data,
}: {
  data: NonNullable<ReturnType<typeof useTwitterProfile>['data']>;
}) {
  const profileUrl = `https://x.com/${encodeURIComponent(data.handle)}`;
  const followingLabel = formatFollowers(data.followingCount);
  const followersLabel = formatFollowers(data.followerCount);

  return (
    <TwitterProfileHoverShell>
      <TwitterProfileBanner bannerUrl={data.bannerUrl} profileUrl={profileUrl} />

      {/* Avatar + identity — negative margin lifts the avatar over the banner edge. */}
      <div className="-mt-8 px-3 pb-3">
        <div
          className="h-16 w-16 overflow-hidden rounded-full bg-white/[0.06] ring-4"
          style={{ ['--tw-ring-color' as string]: TWITTER_PROFILE_HOVER_PANEL_BG }}
        >
          {data.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote avatar */
            <img
              src={data.avatarUrl}
              alt=""
              width={64}
              height={64}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[18px] font-medium text-white/40">
              {data.displayName.slice(0, 1).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="mt-2 min-w-0">
          <div className="flex items-center gap-1">
            <p className="min-w-0 truncate text-[14px] font-semibold leading-tight text-white">
              {data.displayName}
            </p>
            {data.verified ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0 fill-[#1d9bf0] text-[#0a0a0a]"
                strokeWidth={2}
                aria-label="Verified"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[12px] leading-none text-white/50">@{data.handle}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 px-3 pb-2 text-[11.5px] text-white/55">
        {data.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
            {data.location}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
          Joined {formatJoinedDate(data.joinedAt)}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-3 pb-3 text-[12px]">
        <span>
          <span className="font-medium tabular-nums text-white">{followingLabel}</span>{' '}
          <span className="text-white/50">Following</span>
        </span>
        <span>
          <span className="font-medium tabular-nums text-white">{followersLabel}</span>{' '}
          <span className="text-white/50">Followers</span>
        </span>
      </div>

      {/* CTA */}
      <div className="px-3 pb-3">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-white/[0.06] py-2 text-center text-[12px] font-medium text-white/90 transition-colors hover:bg-white/[0.10]"
        >
          See profile on X
        </a>
      </div>
    </TwitterProfileHoverShell>
  );
}

function TwitterProfileHoverSkeleton() {
  return (
    <TwitterProfileHoverShell>
      <div className="h-[96px] w-full animate-pulse bg-white/[0.04]" />
      <div className="-mt-8 px-3 pb-3">
        <div
          className="h-16 w-16 animate-pulse rounded-full bg-white/[0.06] ring-4"
          style={{ ['--tw-ring-color' as string]: TWITTER_PROFILE_HOVER_PANEL_BG }}
        />
        <div className="mt-2 h-3 w-36 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="flex gap-4 px-3 pb-3">
        <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </TwitterProfileHoverShell>
  );
}

function TwitterProfileHoverEmpty({ handle }: { handle: string }) {
  const profileUrl = `https://x.com/${encodeURIComponent(handle)}`;
  return (
    <TwitterProfileHoverShell>
      <TwitterProfileBanner bannerUrl={null} profileUrl={profileUrl} />
      <div className="px-3 pb-3 pt-2 text-[12px] text-white/50">
        Couldn&rsquo;t load profile.
      </div>
    </TwitterProfileHoverShell>
  );
}

/**
 * HoverCard wrapper — wraps any trigger element with a Radix HoverCard that
 * shows {@link TwitterProfileHoverCard} on hover. Used by both the creator-profile
 * icon and the @handle text link so the two share the same surface.
 */
export function TwitterProfileHoverTrigger({
  handle,
  children,
  side = 'right',
  align = 'start',
  sideOffset = 8,
}: {
  handle: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
      >
        <TwitterProfileHoverCard handle={handle} />
      </HoverCardContent>
    </HoverCard>
  );
}

function parseWebsiteHostnameAndHref(url: string): { hostname: string; href: string } {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./i, '') || url;
    return { hostname, href: u.toString() };
  } catch {
    const noProto = url.replace(/^https?:\/\//i, '');
    const host = noProto.split('/')[0]?.replace(/^www\./i, '') ?? '';
    return {
      hostname: host || url.slice(0, 32),
      href: url.startsWith('http') ? url : `https://${url}`,
    };
  }
}

/** Green headline age: tweet post time when URL is an X status ID, else token listing age */
function websiteHoverGreenAgeShort(
  url: string,
  tokenCreatedAt: Date | string | number | null | undefined,
): string {
  const tweetMs = approxTweetCreatedAtMs(url);
  if (tweetMs != null) {
    const label = formatAgeShort(new Date(tweetMs));
    return label.trim() !== '' ? label : '—';
  }
  const listed = formatAgeShort(tokenCreatedAt);
  return listed.trim() !== '' ? listed : '—';
}

/**
 * Axiom-style miniature globe tooltip: hostname (bold left), compact age green right,
 * full href muted below — anchored above the trigger.
 */
export function WebsiteGlobeCompactHover({
  url,
  tokenCreatedAt,
  children,
  placement = 'above',
}: {
  url: string;
  tokenCreatedAt: Date | string | number | null | undefined;
  children: React.ReactNode;
  placement?: 'above' | 'below';
}) {
  const { hostname, href } = parseWebsiteHostnameAndHref(url);
  const age = websiteHoverGreenAgeShort(url, tokenCreatedAt);

  return (
    <PulseCompactHoverAbove
      placement={placement}
      content={
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[11px] font-bold leading-none text-white" title={hostname}>
              {hostname}
            </p>
            <span className="shrink-0 text-[10px] font-semibold tabular-nums leading-none text-signal-bull/75">
              {age}
            </span>
          </div>
          <p
            className="mt-1.5 max-w-[14rem] truncate font-mono text-[9px] leading-snug text-white/45"
            title={href}
          >
            {href}
          </p>
        </>
      }
    >
      {children}
    </PulseCompactHoverAbove>
  );
}

/** Axiom-style telegram peek — channel / invite URL above the icon. */
export function TelegramCompactHover({
  url,
  children,
  placement = 'above',
}: {
  url: string;
  children: React.ReactNode;
  placement?: 'above' | 'below';
}) {
  const display = url.replace(/^https?:\/\//i, '');
  let label = 'Telegram';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.replace(/^\//, '');
    if (path) label = path.startsWith('+') ? path : `@${path.split('/')[0]}`;
  } catch {
    label = display.slice(0, 28);
  }

  return (
    <PulseCompactHoverAbove
      placement={placement}
      content={
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[11px] font-bold leading-none text-white" title={label}>
              {label}
            </p>
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide leading-none text-[#70C0E8]">
              TG
            </span>
          </div>
          <p
            className="mt-1.5 max-w-[14rem] truncate font-mono text-[9px] leading-snug text-white/45"
            title={url}
          >
            {display}
          </p>
        </>
      }
    >
      {children}
    </PulseCompactHoverAbove>
  );
}

export function WebsiteHoverPanel({ url }: { url: string }) {
  const { hostname, href } = parseWebsiteHostnameAndHref(url);
  const twitterish = isTwitterishUrl(url);
  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div>
        <p className={labelMuted}>Website</p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[12px] font-bold text-white">{hostname}</p>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
        </div>
        <p className="mt-1.5 max-w-[15rem] truncate font-mono text-[10px] text-white/50" title={href}>
          {href}
        </p>
        {twitterish ? (
          <p className="mt-2 text-[10px] text-[#70C0E8]/90">
            Resolves to X / Twitter (metadata external link).
          </p>
        ) : null}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/14 py-2 text-[11px] font-semibold text-[#70C0E8] hover:border-[#70C0E8]/45 hover:bg-[#70C0E8]/[0.07]"
      >
        Open link
        <ExternalLink className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}

export function BrandLinkHoverPanel({ url, title }: { url: string; title: string }) {
  const display = url.replace(/^https?:\/\//i, '');
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className={labelMuted}>{title}</p>
      <p className="break-all text-[11px] leading-snug text-white/90">{display}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#70C0E8] hover:underline"
      >
        Open
        <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}

export function FeeShareHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const { token, snapshot } = bundle;
  const dev = token.creator_wallet;
  const top10 = snapshot?.top10_holder_pct;
  const devPct = snapshot?.dev_holding_pct;
  const locked = token.is_lp_locked === true;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div>
        <p className={labelMuted}>Fee authority</p>
        {dev ? (
          <a
            href={explorerAddressUrl(dev)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-[11px] text-white transition hover:border-white/15"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums tabular-nums">{shortenAddress(dev, 4)}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
          </a>
        ) : (
          <p className="mt-1 text-[11px] text-white/50">No creator wallet indexed.</p>
        )}
        <div className="mt-2 flex flex-col gap-0.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
            {locked ? 'Locked' : 'Unknown'}
          </span>
          <span className="text-[10px] text-[#9ca3af]">Status</span>
        </div>
      </div>
      <div>
        <p className={labelMuted}>Shares</p>
        <p className="mt-1 text-[10px] leading-snug text-white/55">
          Holder mix from our latest snapshot.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <TokenImage src={token.image_url} alt="" size={28} className="!rounded-md" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-white">
                  {token.symbol ?? 'Supply'}
                </span>
                <span className="text-[10px] text-emerald-400/90">Top 10 holders</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums text-white">
              {top10 != null ? formatPercent(top10, { decimals: 2 }) : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums text-[11px] text-white">
                {dev ? shortenAddress(dev, 4) : '-'}
              </span>
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-white">
              {devPct != null ? formatPercent(devPct, { decimals: 2 }) : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const rate = agentBuybackPctFromMetadata(bundle);
  const pay = bundle.token.creator_wallet;
  const rateLabel = rate != null ? `${Math.round(rate)}% Buyback` : 'Buyback';

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="text-[11px] font-medium text-[#d1d5db]">Agent actions</p>
        <div className="mt-2 flex items-center gap-2">
          <Bot className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-emerald-400">{rateLabel}</p>
            <p className="text-[10px] text-[#9ca3af]">Rate</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['Buybacks', '$0'],
            ['Revenue', '$0'],
            ['Unclaimed', '$0'],
            ['Claimed', '$0'],
          ] as const
        ).map(([k, v]) => (
          <div
            key={k}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-center"
          >
            <p className="text-[12px] font-semibold tabular-nums text-white">{v}</p>
            <p className="text-[9px] text-[#9ca3af]">{k}</p>
          </div>
        ))}
      </div>
      <div>
        <p className={labelMuted}>Payment authority</p>
        {pay ? (
          <a
            href={explorerAddressUrl(pay)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums">{shortenAddress(pay, 4)}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PumpFunHoverPanel({ bundle, pumpUrl }: { bundle: PulseTokenBundle; pumpUrl: string }) {
  const { token } = bundle;
  const t = formatRelativeTime(token.created_at);

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-xl">
      <div className="relative h-24 w-full bg-bg-hover">
        <TokenImage
          src={token.image_url}
          alt=""
          size={320}
          className="!h-24 !w-full !rounded-none !object-cover"
        />
      </div>
      <div className="px-3 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-white">{token.name ?? token.symbol}</p>
          <p className="shrink-0 text-[11px] text-[#70C0E8]">{t}</p>
        </div>
        <p className="mt-0.5 truncate tabular-nums text-[10px] text-[#9ca3af]">
          {shortenAddress(token.mint, 6)}
        </p>
        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-white/15 bg-black/40 py-2 text-[11px] font-semibold text-white transition hover:border-emerald-400/40 hover:text-emerald-300"
        >
          Open on TON launchpad
        </a>
      </div>
    </div>
  );
}

/**
 * Dev / funding hover panel — three-section layout that mirrors the reference design
 * the user attached in chat: header (mint short + copy + search), two stat cards
 * (native seeded with USD subline, funded age), and a footer wallet pill.
 *
 * Mock numbers are kept lightweight (no oracle wiring yet); replace stub USD
 * conversion once a price service is plumbed.
 */
export function DevFundedHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const { token } = bundle;
  const mint = token.mint;
  const sol = token.initial_liquidity_sol;
  const at = token.initial_liquidity_at;
  const creator = token.creator_wallet;

  /** Stubbed conversion until a price oracle is wired — order-of-magnitude only. */
  const STUB_SOL_USD = 85.3;
  const usdValue = sol != null && Number.isFinite(sol) ? sol * STUB_SOL_USD : null;
  const usdLabel =
    usdValue != null
      ? `$${formatNumber(usdValue, { decimals: usdValue >= 1000 ? 0 : 3, compact: usdValue >= 10_000 })}`
      : '—';
  const solLabel = sol != null ? formatNumber(sol, { decimals: sol >= 1 ? 2 : 3 }) : '—';
  const ageLabel = at ? formatAgeShort(at) : '—';

  const copyMint = () => {
    if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(mint);
  };

  return (
    <div className="flex w-[260px] flex-col gap-2 rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-panel">
      {/* Header — short mint + copy + open */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] leading-none tracking-tight text-white/90">
          {shortenAddress(mint, 8)}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyMint}
            className="inline-flex h-3.5 w-3.5 items-center justify-center text-white/40 transition-colors hover:text-white/80"
            aria-label="Copy mint"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </button>
          <a
            href={`/token/${encodeURIComponent(mint)}`}
            className="inline-flex h-3.5 w-3.5 items-center justify-center text-white/40 transition-colors hover:text-white/80"
            aria-label="Open token workspace"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        </div>
      </div>

      {/* Two-card stat strip */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-2 rounded-md bg-white/[0.04] p-2.5">
          <Coins className="h-4 w-4 shrink-0 text-white/50" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 leading-none">
            <p className="text-[12.5px] tabular-nums leading-none text-white">{solLabel}</p>
            <p className="mt-0.5 text-[10px] leading-none text-white/40">{usdLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-white/[0.04] p-2.5">
          <Clock className="h-4 w-4 shrink-0 text-white/50" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 leading-none">
            <p className="text-[12.5px] tabular-nums leading-none text-white">{ageLabel}</p>
            <p className="mt-0.5 text-[10px] leading-none text-white/40">Funded</p>
          </div>
        </div>
      </div>

      {/* Funder pill */}
      {creator ? (
        <a
          href={explorerAddressUrl(creator)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2.5 py-2 transition-colors hover:bg-white/[0.07]"
        >
          <ArrowUpRight className="h-3 w-3 shrink-0 text-white/40" strokeWidth={1.5} aria-hidden />
          <span className="min-w-0 flex-1 text-center font-mono text-[11px] leading-none text-white/70">
            {shortenAddress(creator, 8)}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-white/40" strokeWidth={1.5} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export function DevWalletIntelHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const { token, snapshot } = bundle;
  const dev = token.creator_wallet;
  const openWallet = useWalletIntelStore((s) => s.openWallet);
  if (!dev) return null;

  const explorer = explorerAddressUrl(dev);
  const devPct = snapshot?.dev_holding_pct;
  const top10 = snapshot?.top10_holder_pct;
  const holders = snapshot?.holder_count;
  const seeded = token.initial_liquidity_sol;
  const fundedAt = token.initial_liquidity_at;
  const locked = token.is_lp_locked === true;

  const copyDev = () => {
    void navigator.clipboard?.writeText(dev);
  };

  return (
    <div className="overflow-hidden rounded-xl">
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">
            Dev wallet
          </p>
          <p className="mt-1 truncate font-mono text-[12px] font-semibold text-white" title={dev}>
            {shortenAddress(dev, 6)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={copyDev}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#9ca3af] transition hover:bg-white/[0.05] hover:text-white"
            aria-label="Copy dev wallet"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#9ca3af] transition hover:bg-white/[0.05] hover:text-white"
            aria-label="Open dev wallet"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/[0.07]">
        <DevStat
          label="Seeded"
          value={seeded != null ? `${formatNumber(seeded, { decimals: 2 })}` : '-'}
          sub={fundedAt ? `${formatAgeShort(fundedAt)} ago` : 'funding'}
        />
        <DevStat
          label="Dev held"
          value={devPct != null ? formatPercent(devPct, { decimals: 1 }) : '-'}
          tone={devPct != null && devPct <= 5 ? 'good' : devPct != null && devPct > 20 ? 'bad' : 'neutral'}
          sub={locked ? 'LP locked' : 'snapshot'}
        />
        <DevStat
          label="Holders"
          value={holders != null ? formatNumber(holders, { decimals: 0, compact: true }) : '-'}
          sub="current"
        />
        <DevStat
          label="Top 10"
          value={top10 != null ? formatPercent(top10, { decimals: 1 }) : '-'}
          tone={top10 != null && top10 > 40 ? 'bad' : 'neutral'}
          sub="supply"
        />
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          type="button"
          onClick={() =>
            openWallet({
              address: dev,
              chain: appChainForWalletAddress(dev),
              rowDemo: true,
            })
          }
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-semibold text-[#d1d5db] transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          <Wallet className="h-3 w-3" strokeWidth={2} />
          Track
        </button>
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-semibold text-[#d1d5db] transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
          Open
        </a>
      </div>
    </div>
  );
}

function DevStat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <div className="bg-[#0f1419] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
      <p
        className={cn(
          'mt-1 tabular-nums text-[12px] font-semibold',
          tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-white',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] text-[#9ca3af]">{sub}</p>
    </div>
  );
}
