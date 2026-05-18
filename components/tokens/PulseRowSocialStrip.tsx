'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { extractTwitterHandle } from '@/lib/utils/extractTwitterHandle';
import { getPulseSocialModel, isTweetOlderThan, ensureBrowserUrl } from '@/lib/tokens/pulseSocialLinks';
import { twitterFollowersFromBundle } from '@/lib/tokens/columnPresetModel';
import type { PulseTokenBundle } from '@/types/tokens';
import { isPumpLiveFromMetadata } from '@/lib/tokens/pulseRichMetadata';
import { PulseGlyphMask, PulseLuminanceGlyph, PULSE_GLYPH, PULSE_INSTAGRAM_SRC, PULSE_BRAND_SRC } from '@/components/tokens/PulseGlyphMask';
import { formatNumber } from '@/lib/utils/formatters';
import { xLiveSearchContractUrl } from '@/lib/utils/xSearch';
import {
  PulseRichHover,
  BrandLinkHoverPanel,
  FeeShareHoverPanel,
  AgentHoverPanel,
  PumpFunHoverPanel,
} from '@/components/tokens/PulseRichPopovers';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type GlyphKey = keyof typeof PULSE_GLYPH;

/** Build profile URL when `tokens.twitter_handle` holds a bare @screen or absolute X URL. */
function twitterProfileUrlFromHandleField(tokenHandle: string | null | undefined): string | null {
  const raw = tokenHandle?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    const browser = ensureBrowserUrl(raw);
    if (browser == null) return null;
    if (browser.includes('/status/')) return null;
    return browser.split('?')[0] ?? null;
  }
  const h = extractTwitterHandle(raw);
  if (!h) return null;
  return `https://x.com/${encodeURIComponent(h)}`;
}

const MS_PER_DAY = 86_400_000;

function StripTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Row icon hit targets — Axiom-style tight cluster.
 *
 * Removed the inner `px-1 py-0.5` padding so adjacent glyphs sit closer
 * together (was visually drifting apart at ~16-20px gaps). Hover/active fills
 * still read clearly because the round bg covers the icon's natural box.
 */
const iconHit = cn(
  // Tighter inner padding/gap so the row reads as a single dense Axiom-style cluster
  // and avoids horizontal overflow when the wide Ultra dock is shown to the right.
  'group inline-flex shrink-0 items-center justify-center gap-px',
  'border-0 bg-transparent px-0.5 py-px shadow-none outline-none ring-0',
  // Icon color: whitish-grey (light enough to read at a glance, slightly cooler than
  // pure white so it stays "secondary" vs. the stat numbers). `fg-muted` was too
  // dark to read comfortably; `fg-primary/85` keeps the icons near-white but
  // subtly desaturated. Hover lifts to full white.
  'rounded-md text-fg-primary/85 hover:bg-white/[0.1] hover:text-fg-primary active:bg-white/[0.12]',
  'transition-colors duration-100 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-0',
);

function statNumberClsFor(_glyphPx: number) {
  // Axiom-style tight cluster: number sits flush against the glyph, slightly smaller
  // so the row stays compact without overflowing past the Ultra dock. Numbers stay
  // fully white (no opacity scaling) so they read crisply next to the grey icons.
  return 'ml-0 font-sans text-[12px] font-medium leading-none tracking-tight text-fg-primary';
}

type TwitterTweetAuthor = {
  name?: string | null;
  handle?: string | null;
  avatar?: string | null;
  verified?: boolean;
};

type TwitterPreviewData =
  | {
      type: 'tweet';
      fallback: boolean;
      url: string;
      text?: string | null;
      createdAt?: string | null;
      author?: TwitterTweetAuthor | null;
      favorites?: number | null;
      media?: string | null;
    }
  | {
      type: 'profile';
      handle: string;
      profileUrl: string;
      fallback?: boolean;
    };

function twitterHoverClientFallback(href: string): TwitterPreviewData {
  const isTweet = /\/status\/\d+/.test(href);
  if (isTweet) {
    return { type: 'tweet', fallback: true, url: href };
  }
  const handle = extractTwitterHandle(href) || 'unknown';
  return {
    type: 'profile',
    handle,
    profileUrl: `https://x.com/${encodeURIComponent(handle)}`,
    fallback: true,
  };
}

/**
 * Twitter/X profile + tweet preview popover.
 *
 * Matches the inline-positioned mouseEnter/Leave + timeout pattern used by
 * `PulseRichHover` (no portal, no shadcn Popover dep), but uses the Pulse
 * polish-spec chrome (`bg-bg-raised border-border-subtle rounded-lg shadow-panel`)
 * instead of PulseRichHover's heavier dark glass surface. Fetches
 * `/api/twitter-preview` once per hover (cached for the lifetime of the wrapper).
 */
function TwitterLinkHover({ url, children }: { url: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TwitterPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    fetched.current = false;
    setData(null);
  }, [url]);

  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };

  useEffect(() => () => clear(), []);

  const fetchPreview = async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/twitter-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('[TwitterHover] API failed:', res.status, errText);
        setData(twitterHoverClientFallback(url));
        return;
      }
      const json: unknown = await res.json();
      if (
        json &&
        typeof json === 'object' &&
        (json as { type?: unknown }).type === 'tweet' &&
        typeof (json as { url?: unknown }).url === 'string'
      ) {
        setData(json as TwitterPreviewData);
        return;
      }
      if (
        json &&
        typeof json === 'object' &&
        (json as { type?: unknown }).type === 'profile' &&
        typeof (json as { handle?: unknown }).handle === 'string' &&
        typeof (json as { profileUrl?: unknown }).profileUrl === 'string'
      ) {
        setData(json as TwitterPreviewData);
        return;
      }
      setData(twitterHoverClientFallback(url));
    } catch (e) {
      console.warn('[TwitterHover] fetch error:', e);
      setData(twitterHoverClientFallback(url));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="relative isolate inline-flex">
      <span
        className="inline-flex"
        onMouseEnter={() => {
          clear();
          t.current = setTimeout(() => {
            setOpen(true);
            void fetchPreview();
          }, 400);
        }}
        onMouseLeave={() => {
          clear();
          t.current = setTimeout(() => setOpen(false), 200);
        }}
      >
        {children}
      </span>
      {open ? (
        <div
          role="dialog"
          aria-label="X preview"
          className="pointer-events-auto absolute left-1/2 top-[calc(100%+10px)] z-50 w-[280px] -translate-x-1/2 overflow-hidden rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-panel"
          onMouseEnter={() => {
            clear();
            setOpen(true);
          }}
          onMouseLeave={() => {
            clear();
            t.current = setTimeout(() => setOpen(false), 200);
          }}
        >
          {loading && !data ? (
            <p className="text-xs text-fg-muted">Loading preview…</p>
          ) : null}
          {data?.type === 'tweet' && !data.fallback ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {data.author?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- X CDN avatar
                  <img
                    src={data.author.avatar}
                    alt=""
                    className="h-8 w-8 rounded-full bg-transparent object-cover ring-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-bg-sunken" />
                )}
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs font-semibold text-fg-primary">{data.author?.name}</span>
                    {data.author?.verified ? (
                      <span className="text-[10px] text-accent-primary">✓</span>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-fg-muted">@{data.author?.handle ?? '…'}</span>
                </div>
                <span className="ml-auto text-sm font-bold text-fg-muted">𝕏</span>
              </div>
              {data.text ? (
                <p className="line-clamp-4 text-[11px] leading-relaxed text-fg-secondary">{data.text}</p>
              ) : null}
              {data.media ? (
                // eslint-disable-next-line @next/next/no-img-element -- tweet media CDN
                <img src={data.media} alt="" className="w-full rounded border border-border-subtle" />
              ) : null}
              <div className="mt-1 flex items-center justify-between">
                {data.favorites != null ? (
                  <span className="text-[10px] text-fg-muted">❤ {data.favorites.toLocaleString()}</span>
                ) : (
                  <span />
                )}
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent-primary hover:text-accent-glow"
                >
                  View on X →
                </a>
              </div>
            </div>
          ) : null}
          {data?.type === 'tweet' && data.fallback ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-fg-muted">Tweet preview unavailable from X syndication.</p>
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent-primary hover:text-accent-glow"
              >
                View on X →
              </a>
            </div>
          ) : null}
          {data?.type === 'profile' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 text-white/85">
                  <PulseGlyphMask name="profile" size={32} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-sm font-semibold text-fg-primary">
                    @{data.handle.replace(/^@/, '')}
                  </span>
                  <span className="text-[10px] text-fg-muted">X profile</span>
                </div>
                <span className="ml-auto text-sm font-bold text-fg-muted">𝕏</span>
              </div>
              <a
                href={data.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-7 w-full items-center justify-center rounded border border-border text-xs text-fg-secondary transition-colors hover:border-border-strong hover:text-fg-primary"
              >
                See profile on X →
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

function SocialTooltip({
  open,
  previewTitle,
  previewSubtitle,
}: {
  open: boolean;
  previewTitle: string;
  previewSubtitle?: string;
}) {
  if (!open) return null;
  return (
        <div
          className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[90] w-[13.5rem] -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#0a0b0d]/98 px-2.5 py-2 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md"
          role="tooltip"
        >
          <p className="text-[11px] font-semibold leading-snug text-white/95">{previewTitle}</p>
          {previewSubtitle ? (
            <p className="mt-0.5 text-[10px] leading-snug text-white/50">{previewSubtitle}</p>
          ) : null}
        </div>
  );
}

function WithHoverTooltip({
  children,
  previewTitle,
  previewSubtitle,
}: {
  children: ReactNode;
  previewTitle: string;
  previewSubtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        clear();
        t.current = setTimeout(() => setOpen(true), 90);
      }}
      onMouseLeave={() => {
        clear();
        t.current = setTimeout(() => setOpen(false), 160);
      }}
    >
      {children}
      <SocialTooltip open={open} previewTitle={previewTitle} previewSubtitle={previewSubtitle} />
    </span>
  );
}

function ExternalGlyphLink({
  href,
  label,
  glyph,
  previewTitle,
  previewSubtitle,
  linkClassName,
  glyphPx,
}: {
  href: string;
  label: string;
  glyph: GlyphKey;
  previewTitle: string;
  previewSubtitle?: string;
  linkClassName?: string;
  glyphPx: number;
}) {
  return (
    <WithHoverTooltip previewTitle={previewTitle} previewSubtitle={previewSubtitle}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(iconHit, linkClassName)}
      >
        <PulseGlyphMask name={glyph} size={glyphPx} />
      </a>
    </WithHoverTooltip>
  );
}

function ExternalCommunityStatLink({
  href,
  stat,
  previewTitle,
  previewSubtitle,
  glyphPx,
}: {
  href: string;
  stat: ReactNode;
  previewTitle: string;
  previewSubtitle?: string;
  glyphPx: number;
}) {
  return (
    <WithHoverTooltip previewTitle={previewTitle} previewSubtitle={previewSubtitle}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X community"
        className={cn(iconHit, 'pl-0 pr-0')}
      >
        <PulseLuminanceGlyph src={PULSE_BRAND_SRC.communities} size={glyphPx} />
        <span className={statNumberClsFor(glyphPx)}>{stat}</span>
      </a>
    </WithHoverTooltip>
  );
}

function InternalGlyphStatLink({
  href,
  label,
  glyph,
  stat,
  glyphPx,
}: {
  href: string;
  label: string;
  glyph: GlyphKey;
  stat: ReactNode;
  glyphPx: number;
}) {
  return (
    <StripTip label={label}>
      <Link href={href} aria-label={label} className={cn(iconHit, 'pl-0 pr-0')}>
        <PulseGlyphMask name={glyph} size={glyphPx} />
        <span className={statNumberClsFor(glyphPx)}>{stat}</span>
      </Link>
    </StripTip>
  );
}

function InternalCommunityStatLink({
  href,
  stat,
  glyphPx,
}: {
  href: string;
  stat: ReactNode;
  glyphPx: number;
}) {
  return (
    <StripTip label="Holders">
      <Link href={href} aria-label="Holders" className={cn(iconHit, 'pl-0 pr-0')}>
        <PulseLuminanceGlyph src={PULSE_BRAND_SRC.communities} size={glyphPx} />
        <span className={statNumberClsFor(glyphPx)}>{stat}</span>
      </Link>
    </StripTip>
  );
}

function ExternalInstagramLink({
  href,
  previewTitle,
  previewSubtitle,
  glyphPx,
}: {
  href: string;
  previewTitle: string;
  previewSubtitle?: string;
  glyphPx: number;
}) {
  return (
    <WithHoverTooltip previewTitle={previewTitle} previewSubtitle={previewSubtitle}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className={iconHit}
      >
        <span
          className="relative shrink-0 overflow-hidden"
          style={{ width: glyphPx, height: glyphPx }}
        >
          <img
            src={PULSE_INSTAGRAM_SRC}
            alt=""
            width={glyphPx}
            height={glyphPx}
            className="h-full w-full border-0 object-contain mix-blend-lighten ring-0"
            draggable={false}
          />
        </span>
      </a>
    </WithHoverTooltip>
  );
}

function BrandIconLink({
  href,
  label,
  src,
  panelTitle,
  glyphPx,
}: {
  href: string;
  label: string;
  src: string;
  panelTitle: string;
  glyphPx: number;
}) {
  return (
    <PulseRichHover panel={<BrandLinkHoverPanel url={href} title={panelTitle} />} wide={false}>
      <StripTip label={label}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={iconHit}
        >
          <PulseLuminanceGlyph src={src} size={glyphPx} />
        </a>
      </StripTip>
    </PulseRichHover>
  );
}

export function PulseRowSocialStrip({
  bundle,
  compact,
  traits,
  glyphSize,
  showTxCount = true,
  showDevWallet = true,
  /** Pulse table rows: stack icon row / @handle row with spacing for metric pills below (Axiom-style). */
  pulseBoard = false,
}: {
  bundle: PulseTokenBundle;
  compact?: boolean;
  traits?: { cashback: boolean; feeShare: boolean; agent: boolean };
  glyphSize?: number;
  showTxCount?: boolean;
  showDevWallet?: boolean;
  pulseBoard?: boolean;
}) {
  // Default ~25% larger than the previous 20/24 to match Axiom's icon weight.
  // Each call site can still override (Track / share previews use smaller).
  const sx = glyphSize ?? 26;
  const followerGlyph = Math.max(14, Math.round(sx * 0.55));
  const model = useMemo(() => getPulseSocialModel(bundle), [bundle]);
  const twFollowers = useMemo(() => twitterFollowersFromBundle(bundle), [bundle]);
  const tokenPath = `/token/${encodeURIComponent(bundle.token.mint)}`;
  const snapshot = bundle.snapshot;
  const holders = snapshot?.holder_count;
  const txns = snapshot?.txns_1h ?? snapshot?.txns_5m ?? null;

  const cashback = traits?.cashback ?? false;
  const feeShare = traits?.feeShare ?? false;
  const agent = traits?.agent ?? false;
  const pumpLive = isPumpLiveFromMetadata(bundle);

  const profile = model.twitterProfile;

  const twitterProfileUrl =
    profile?.url ?? twitterProfileUrlFromHandleField(bundle.token.twitter_handle);
  const handleFromToken = bundle.token.twitter_handle
    ? extractTwitterHandle(bundle.token.twitter_handle)
    : '';
  const twitterDisplayHandle =
    profile?.handle?.replace(/^@/, '') || (handleFromToken !== '' ? handleFromToken : null);

  const showFollowerRow =
    twitterDisplayHandle &&
    twitterProfileUrl &&
    twFollowers != null &&
    twFollowers > 0;

  const txLabel = txns != null ? formatNumber(txns, { decimals: 0 }) : '0';
  const crownDen = holders != null && holders > 0 ? String(holders) : '0';

  const tweetUrl = model.twitterTweet?.url;
  const tweetStale = tweetUrl ? isTweetOlderThan(tweetUrl, MS_PER_DAY) : null;

  const pumpUrl = model.pumpFunUrl;

  const devWalletAddr = bundle.token.creator_wallet;

  return (
    <div
      className={cn(
        'min-w-0 font-sans',
        pulseBoard ? 'flex min-w-0 flex-1 flex-col gap-1' : compact ? 'mt-0' : 'mt-1',
      )}
    >
      {/* gap-px (was gap-0.5 → 2): even tighter Axiom-style cluster so the strip
          stays single-line under the name without cutting the trailing crown stat. */}
      <div className="flex min-w-0 flex-nowrap items-center gap-px overflow-x-auto overflow-y-hidden overscroll-x-contain py-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {twitterProfileUrl ? (
          <TwitterLinkHover url={twitterProfileUrl}>
            <StripTip
              label={`Creator profile on X${twitterDisplayHandle ? ` (@${twitterDisplayHandle})` : ''}`}
            >
              <a
                href={twitterProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Creator profile on X (@${twitterDisplayHandle ?? 'unknown'})`}
                className={iconHit}
              >
                <PulseGlyphMask name="profile" size={22} />
              </a>
            </StripTip>
          </TwitterLinkHover>
        ) : null}

        {tweetUrl ? (
          <TwitterLinkHover url={tweetUrl}>
            <StripTip
              label={tweetStale === true ? 'Linked post on X — over 24h old' : 'Linked post on X'}
            >
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tweetStale === true ? 'Post on X (over 24h old)' : 'Post on X'}
                className={iconHit}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled PNG asset */}
                <img
                  src="/icons/twitter-tweet.png"
                  alt="Twitter tweet"
                  className={cn(
                    'h-[22px] w-[22px] shrink-0 object-contain opacity-90 transition-opacity hover:opacity-100',
                    tweetStale === true && 'rounded-sm ring-2 ring-signal-warn/45',
                  )}
                />
              </a>
            </StripTip>
          </TwitterLinkHover>
        ) : null}

        {model.twitterSearch?.url ? (
          <ExternalGlyphLink
            href={model.twitterSearch.url}
            label="Search on X"
            glyph="xLogo"
            previewTitle="X search or query"
            previewSubtitle="Search, hashtag, or explore link from metadata"
            glyphPx={sx}
          />
        ) : null}

        {model.telegram ? (
          <ExternalGlyphLink
            href={model.telegram}
            label="Telegram"
            glyph="telegram"
            previewTitle="Telegram"
            previewSubtitle="Channel or chat"
            glyphPx={sx}
          />
        ) : null}

        {model.instagram ? (
          <ExternalInstagramLink
            href={model.instagram}
            previewTitle="Instagram"
            previewSubtitle={model.instagram.replace(/^https?:\/\//i, '').slice(0, 52)}
            glyphPx={sx}
          />
        ) : null}

        {model.github ? (
          <BrandIconLink
            href={model.github}
            label="GitHub"
            src={PULSE_BRAND_SRC.github}
            panelTitle="GitHub"
            glyphPx={sx}
          />
        ) : null}
        {model.youtube ? (
          <BrandIconLink
            href={model.youtube}
            label="YouTube"
            src={PULSE_BRAND_SRC.youtube}
            panelTitle="YouTube"
            glyphPx={sx}
          />
        ) : null}
        {model.tiktok ? (
          <BrandIconLink
            href={model.tiktok}
            label="TikTok"
            src={PULSE_BRAND_SRC.tiktok}
            panelTitle="TikTok"
            glyphPx={sx}
          />
        ) : null}

        {model.website ? (
          <StripTip label="Website">
            <a
              href={model.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Website"
              className={iconHit}
            >
              <PulseGlyphMask name="globe" size={sx} />
            </a>
          </StripTip>
        ) : null}

        {pumpUrl ? (
          pumpLive ? (
            <PulseRichHover panel={<PumpFunHoverPanel bundle={bundle} pumpUrl={pumpUrl} />}>
              <StripTip label="TON launchpad livestream">
                <a
                  href={pumpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TON launchpad (live)"
                  className={iconHit}
                >
                  <PulseGlyphMask
                    name="pump"
                    size={sx}
                    variant="natural"
                    className="drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                  />
                </a>
              </StripTip>
            </PulseRichHover>
          ) : (
            <StripTip label="TON launchpad">
              <a
                href={pumpUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TON launchpad"
                className={iconHit}
              >
                <PulseGlyphMask name="pump" size={sx} variant="mono" />
              </a>
            </StripTip>
          )
        ) : null}

        {agent ? (
          <PulseRichHover wide panel={<AgentHoverPanel bundle={bundle} />}>
            <StripTip label="Agent">
              <Link href={tokenPath} aria-label="Agent details" className={iconHit}>
                <PulseGlyphMask name="agent" size={sx} variant="natural" />
              </Link>
            </StripTip>
          </PulseRichHover>
        ) : null}

        {cashback ? (
          <StripTip label="Cashback">
            <span
              className={cn(iconHit, 'pointer-events-none cursor-default')}
              aria-label="Cashback token"
              role="img"
            >
              <PulseGlyphMask name="cashback" size={sx} variant="natural" />
            </span>
          </StripTip>
        ) : null}

        {feeShare ? (
          <PulseRichHover wide panel={<FeeShareHoverPanel bundle={bundle} />}>
            <StripTip label="Fee shared - hover for breakdown">
              <span className={cn(iconHit, 'cursor-default')} aria-label="Creator fee / revenue share" role="button">
                <PulseGlyphMask name="feeShare" size={sx} variant="natural" />
              </span>
            </StripTip>
          </PulseRichHover>
        ) : null}

        <ExternalGlyphLink
          href={xLiveSearchContractUrl(bundle.token.mint)}
          label="Search contract on X"
          glyph="search"
          previewTitle="Search this contract on X"
          previewSubtitle="Opens X live search with the full mint address"
          glyphPx={sx}
        />

        {model.twitterCommunity?.url ? (
          <ExternalCommunityStatLink
            href={model.twitterCommunity.url}
            stat={holders != null ? formatNumber(holders, { decimals: 0 }) : '0'}
            previewTitle="X community"
            previewSubtitle="Community from metadata"
            glyphPx={sx}
          />
        ) : (
          <InternalCommunityStatLink
            href={tokenPath}
            stat={holders != null ? formatNumber(holders, { decimals: 0 }) : '0'}
            glyphPx={sx}
          />
        )}

        <InternalGlyphStatLink
          href={tokenPath}
          label="Token chart and trades"
          glyph="chart"
          stat={txLabel}
          glyphPx={sx}
        />

        <InternalGlyphStatLink
          href={tokenPath}
          label="Token holders and stats"
          glyph="trophy"
          stat="0"
          glyphPx={sx}
        />

        <InternalGlyphStatLink
          href={tokenPath}
          label="Token overview"
          glyph="crown"
          stat={`0/${crownDen}`}
          glyphPx={sx}
        />

        {showDevWallet && devWalletAddr && !pulseBoard ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/wallet/${encodeURIComponent(devWalletAddr)}`}
                className="flex cursor-default items-center"
                aria-label={`Dev wallet ${devWalletAddr}`}
                data-row-click-skip="true"
              >
                <ChefHat className="h-[22px] w-[22px] shrink-0 text-signal-warn" strokeWidth={2.25} aria-hidden />
              </Link>
            </TooltipTrigger>
            {/* Tooltip is the full address only — no "Dev wallet:" prefix. */}
            <TooltipContent className="font-mono">{devWalletAddr}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {showFollowerRow ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-0.5',
            pulseBoard ? 'mt-0' : 'mt-0.5',
          )}
        >
          <a
            href={twitterProfileUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[#5ebbff] hover:text-[#7dd3fc] hover:underline"
          >
            @{twitterDisplayHandle}
          </a>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-primary/75">
            <span className="inline-flex shrink-0 text-[#5ebbff]">
              <PulseGlyphMask name="profile" size={followerGlyph} />
            </span>
            <span className="tabular-nums text-[#5ebbff]">{formatNumber(twFollowers, { compact: true })}</span>
          </span>
        </div>
      ) : twitterDisplayHandle && twitterProfileUrl ? (
        <a
          href={twitterProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-medium text-[#70C0E8] hover:text-[#9dd8f5] hover:underline',
            pulseBoard ? 'mt-0' : 'mt-0.5',
          )}
        >
          <span className="inline-flex shrink-0 text-[#70C0E8] opacity-95 hover:opacity-100">
            <PulseGlyphMask name="profile" size={16} />
          </span>
          @{twitterDisplayHandle}
        </a>
      ) : null}
    </div>
  );
}
