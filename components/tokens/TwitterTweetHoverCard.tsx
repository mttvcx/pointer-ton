'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  Bookmark,
  Camera,
  Calendar,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  Repeat2,
} from 'lucide-react';
import {
  HoverCard,
  HoverCardBridge,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePulseHiddenMintsStore } from '@/store/pulseHiddenMints';
import { useTwitterTweetPreview } from '@/lib/hooks/useTwitterTweetPreview';
import {
  formatAxiomEngagement,
  formatAxiomFollowers,
  formatAxiomJoined,
  formatAxiomTweetTimestamp,
} from '@/lib/twitter/tweetHoverFormat';
import {
  tweetPreviewMediaUrls,
  type TwitterTweetPreview,
  type TwitterTweetPreviewQuote,
} from '@/lib/twitter/tweetPreviewTypes';
import { formatAgeShort } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

/** Axiom tweet / profile hover panel — exact Axiom surface color. */
export const AXIOM_TWITTER_HOVER_PANEL_BG = '#1e2732';
const AXIOM_MUTED = '#71767b';
const AXIOM_TEXT = '#e7e9ea';
const AXIOM_AGE = '#f4212e';
const AXIOM_HEART = '#f91880';
const AXIOM_RETWEET = '#00ba7c';
const AXIOM_REPLY = '#1d9bf0';

function absImageUrl(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (typeof window === 'undefined') return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={cn('h-[18px] w-[18px]', className)}>
      <path
        d="M11.6 2.5h2.1L9.1 7.78l5.4 5.72H10.4l-3.3-3.96L3.3 13.5H1.2l4.95-5.66L1 2.5h4.2l3 3.62L11.6 2.5zm-.36 9.6h1.16L4.85 3.8H3.6l7.64 8.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function TwitterTweetHoverShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-x-hidden overflow-y-auto rounded-2xl border border-white/[0.08] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.85)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      // Cap to the space Radix has before a collision (it already flips/shifts via
      // collisionPadding) so a tall tweet scrolls inside the card instead of
      // overflowing the viewport. Fallback for any non-Radix usage.
      style={{
        backgroundColor: AXIOM_TWITTER_HOVER_PANEL_BG,
        maxHeight: 'var(--radix-hover-card-content-available-height, calc(100vh - 24px))',
      }}
    >
      {children}
    </div>
  );
}

function TwitterTweetMediaHover({ src, className }: { src: string; className?: string }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    left: number;
    width: number;
    anchorBottom: number;
  } | null>(null);
  const [topPx, setTopPx] = useState(0);

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const syncPanelPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const width = Math.min(320, Math.max(r.width * 2.2, 200));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPanelPos({ left, width, anchorBottom: r.bottom });
    setTopPx(r.bottom + 8); // refined to fit the viewport once the card measures
  }, []);

  // Keep the WHOLE card on screen: open below the anchor, but shift it up only as
  // much as needed so it never clips at the bottom (lands mid-screen near the
  // viewport bottom). Runs before paint, so there's no visible jump.
  useLayoutEffect(() => {
    if (!hovered || !panelPos || typeof window === 'undefined') return;
    const h = cardRef.current?.offsetHeight ?? 0;
    const gap = 8;
    const maxTop = window.innerHeight - h - gap;
    setTopPx(Math.max(gap, Math.min(panelPos.anchorBottom + gap, maxTop)));
  }, [hovered, panelPos]);

  const scheduleOpen = () => {
    clearHoverTimer();
    syncPanelPos();
    setHovered(true);
  };

  const scheduleClose = () => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => {
      setHovered(false);
      setPanelPos(null);
    }, 120);
  };

  const openLens = () => {
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(absImageUrl(src))}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  useEffect(() => {
    if (!hovered) return;
    const close = () => {
      setHovered(false);
      setPanelPos(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [hovered]);

  const previewPanel =
    hovered && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={cardRef}
            className="pointer-events-auto fixed z-[280] overflow-x-hidden overflow-y-auto rounded-xl border border-white/[0.12] bg-[#0a0c10] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.9)] [scrollbar-width:none]"
            style={{
              top: topPx,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: 'calc(100vh - 16px)',
            }}
            data-row-click-skip="true"
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              aria-label="Search this image on Google Lens"
              data-row-click-skip="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLens();
              }}
              className="group/preview relative block w-full overflow-hidden transition hover:brightness-105"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="block h-auto w-full object-cover" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover/preview:bg-black/35">
                <Camera
                  className="h-6 w-6 text-white opacity-0 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition group-hover/preview:opacity-100"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        className={cn('group/media relative overflow-hidden rounded-xl border border-white/[0.1]', className)}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        data-row-click-skip="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full object-cover transition duration-200 group-hover/media:scale-[1.02]" draggable={false} />
      </div>
      {previewPanel}
    </>
  );
}

function TwitterAffiliationBadge({
  affiliation,
}: {
  affiliation: NonNullable<TwitterTweetPreview['author']>['affiliation'];
}) {
  if (!affiliation) return null;
  const inner = affiliation.badgeUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- X affiliation badge CDN
    <img
      src={affiliation.badgeUrl}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4 shrink-0 rounded-[3px] object-cover"
      draggable={false}
    />
  ) : (
    <span
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[3px] bg-black px-1 text-[9px] font-bold text-white"
      aria-hidden
    >
      {affiliation.name.slice(0, 1)}
    </span>
  );

  if (affiliation.url) {
    return (
      <a
        href={affiliation.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={affiliation.name}
        title={affiliation.name}
        className="inline-flex shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </a>
    );
  }

  return <span className="inline-flex shrink-0">{inner}</span>;
}

function BlacklistTwitterButton({ handle }: { handle: string }) {
  const blacklistTwitter = usePulseHiddenMintsStore((s) => s.blacklistTwitter);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Blacklist Twitter Profile"
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 transition hover:bg-white/[0.06]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            blacklistTwitter(handle);
          }}
        >
          <EyeOff className="h-3.5 w-3.5" style={{ color: AXIOM_MUTED }} strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">
        Blacklist Twitter Profile
      </TooltipContent>
    </Tooltip>
  );
}

function TweetAuthorHeader({
  author,
  createdAt,
  tweetUrl,
}: {
  author: TwitterTweetPreview['author'];
  createdAt: string | null;
  tweetUrl: string;
}) {
  const ageLabel = createdAt ? formatAgeShort(new Date(createdAt)) : null;
  const joinedLabel = formatAxiomJoined(author?.joinedAt);
  const followersCount =
    author?.followerCount != null ? formatAxiomFollowers(author.followerCount) : null;
  const profileUrl = author?.profileUrl;
  const handle = author?.handle?.replace(/^@/, '') ?? null;
  const showProfileMeta = Boolean(joinedLabel || followersCount);

  const avatarNode = author?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- X CDN avatar
    <img
      src={author.avatar}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      draggable={false}
    />
  ) : (
    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]" />
  );

  return (
    <div className="flex items-start gap-3">
      {profileUrl ? (
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {avatarNode}
        </a>
      ) : (
        avatarNode
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[15px] font-bold leading-tight hover:underline"
                  style={{ color: AXIOM_TEXT }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {author?.name ?? 'Unknown'}
                </a>
              ) : (
                <p className="truncate text-[15px] font-bold leading-tight" style={{ color: AXIOM_TEXT }}>
                  {author?.name ?? 'Unknown'}
                </p>
              )}
              {author?.verified ? (
                <BadgeCheck
                  className="h-[17px] w-[17px] shrink-0 fill-[#1d9bf0] text-black"
                  strokeWidth={2}
                  aria-label="Verified"
                />
              ) : null}
              <TwitterAffiliationBadge affiliation={author?.affiliation ?? null} />
            </div>
            {handle ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-1">
                <a
                  href={profileUrl ?? `https://x.com/${encodeURIComponent(handle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[13px] leading-tight hover:underline"
                  style={{ color: AXIOM_MUTED }}
                  onClick={(e) => e.stopPropagation()}
                >
                  @{handle}
                </a>
                <BlacklistTwitterButton handle={handle} />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on X"
              className="inline-flex"
              onClick={(e) => e.stopPropagation()}
            >
              <XGlyph className="text-white/90" />
            </a>
            {ageLabel ? (
              <span
                className="mt-0.5 text-[12px] font-bold tabular-nums leading-none"
                style={{ color: AXIOM_AGE }}
              >
                {ageLabel}
              </span>
            ) : null}
          </div>
        </div>
        {showProfileMeta ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
            style={{ color: AXIOM_MUTED }}
          >
            {joinedLabel ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Joined {joinedLabel}
              </span>
            ) : null}
            {followersCount ? (
              <span>
                <span className="font-bold" style={{ color: AXIOM_TEXT }}>
                  {followersCount}
                </span>{' '}
                followers
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuotedTweetCard({ quote }: { quote: TwitterTweetPreviewQuote }) {
  const author = quote.author;
  const ageLabel = quote.createdAt ? formatAgeShort(new Date(quote.createdAt)) : null;
  const quoteMediaUrls = tweetPreviewMediaUrls(quote);

  return (
    <div className="mt-3 rounded-xl border border-white/[0.12] p-3">
      <div className="flex items-start gap-2">
        {author?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="h-5 w-5 shrink-0 rounded-full bg-white/[0.08]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-[13px] font-bold leading-tight" style={{ color: AXIOM_TEXT }}>
                  {author?.name ?? 'Unknown'}
                </p>
                {author?.verified ? (
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0 fill-[#1d9bf0] text-black"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
              </div>
              {author?.handle ? (
                <p className="truncate text-[12px] leading-tight" style={{ color: AXIOM_MUTED }}>
                  @{author.handle}
                </p>
              ) : null}
            </div>
            {ageLabel ? (
              <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: AXIOM_AGE }}>
                {ageLabel}
              </span>
            ) : null}
          </div>
          {quote.text ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.45]" style={{ color: AXIOM_TEXT }}>
              {quote.text}
            </p>
          ) : null}
          {quoteMediaUrls.length > 0 ? (
            <div
              className={cn(
                'mt-2 grid gap-1',
                quoteMediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {quoteMediaUrls.slice(0, 4).map((url) => (
                <TwitterTweetMediaHover key={url} src={url} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TweetEngagementFooter({ data }: { data: TwitterTweetPreview }) {
  return (
    <div className="shrink-0 border-t border-white/[0.08] px-5 pb-5 pt-3">
      <div className="flex items-center justify-between gap-2 text-[13px]" style={{ color: AXIOM_MUTED }}>
        <span className="min-w-0 truncate">{formatAxiomTweetTimestamp(data.createdAt)}</span>
        <div className="flex shrink-0 items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Bookmark className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
            {formatAxiomEngagement(data.bookmarks)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
            {formatAxiomEngagement(data.views)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-5 text-[13px] font-medium tabular-nums">
        <span className="inline-flex items-center gap-1.5" style={{ color: AXIOM_HEART }}>
          <Heart className="h-4 w-4 fill-current" strokeWidth={0} aria-hidden />
          {formatAxiomEngagement(data.favorites)}
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: AXIOM_RETWEET }}>
          <Repeat2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          {formatAxiomEngagement(data.retweets)}
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: AXIOM_REPLY }}>
          <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
          {formatAxiomEngagement(data.replies)}
        </span>
      </div>

      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center rounded-full border py-2.5 text-center text-[14px] font-bold transition hover:bg-[#1d9bf0]/[0.08]"
        style={{ borderColor: AXIOM_REPLY, color: AXIOM_REPLY }}
      >
        Read more on X
      </a>
    </div>
  );
}

function TwitterTweetHoverSkeleton() {
  return (
    <TwitterTweetHoverShell>
      <div className="space-y-3 p-5">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-14 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </TwitterTweetHoverShell>
  );
}

function TwitterTweetHoverFallback({ url }: { url: string }) {
  return (
    <TwitterTweetHoverShell>
      <div className="space-y-3 p-5">
        <p className="text-[13px]" style={{ color: AXIOM_MUTED }}>
          Tweet preview unavailable.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center rounded-full border py-2.5 text-center text-[14px] font-bold"
          style={{ borderColor: AXIOM_REPLY, color: AXIOM_REPLY }}
        >
          Read more on X
        </a>
      </div>
    </TwitterTweetHoverShell>
  );
}

function TwitterTweetHoverBody({ data }: { data: TwitterTweetPreview }) {
  const mediaUrls = tweetPreviewMediaUrls(data);

  return (
    <TwitterTweetHoverShell>
      <div
        className="scrollbar-none min-h-0 max-h-[min(520px,72vh)] overflow-y-auto overscroll-contain px-5 pt-5"
        onWheel={(e) => e.stopPropagation()}
      >
        <TweetAuthorHeader author={data.author} createdAt={data.createdAt} tweetUrl={data.url} />

        {data.replyingTo ? (
          <div className="mt-3 flex gap-2 border-l-2 border-white/[0.15] pl-3">
            <p className="text-[13px] leading-snug" style={{ color: AXIOM_MUTED }}>
              Replying to{' '}
              <span className="text-[#1d9bf0]">@{data.replyingTo.replace(/^@/, '')}</span>
            </p>
          </div>
        ) : null}

        {data.text ? (
          <p
            className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.5]"
            style={{ color: AXIOM_TEXT }}
          >
            {data.text}
          </p>
        ) : null}

        {data.quotedTweet ? <QuotedTweetCard quote={data.quotedTweet} /> : null}

        {mediaUrls.length > 0 ? (
          <div
            className={cn(
              'mt-3 grid gap-1',
              mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {mediaUrls.slice(0, 4).map((url) => (
              <TwitterTweetMediaHover key={url} src={url} />
            ))}
          </div>
        ) : null}
      </div>

      <TweetEngagementFooter data={data} />
    </TwitterTweetHoverShell>
  );
}

/** Axiom-style linked-post hover — syndication + engagement enrichment. */
export function TwitterTweetHoverCard({ url }: { url: string }) {
  const { data, isLoading, isError } = useTwitterTweetPreview(url);

  if (isLoading && !data) return <TwitterTweetHoverSkeleton />;
  if (isError && !data) return <TwitterTweetHoverFallback url={url} />;
  if (!data || data.fallback) return <TwitterTweetHoverFallback url={url} />;
  return <TwitterTweetHoverBody data={data} />;
}

/** Radix HoverCard wrapper for tweet / feather icons (collision-aware, no double tooltip). */
export function TwitterTweetHoverTrigger({
  url,
  children,
  side = 'bottom',
  align = 'start',
  sideOffset = 0,
}: {
  url: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        instant
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <HoverCardBridge side={side}>
          <TwitterTweetHoverCard url={url} />
        </HoverCardBridge>
      </HoverCardContent>
    </HoverCard>
  );
}
