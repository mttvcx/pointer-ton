'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { getPulseSocialModel, isTweetOlderThan } from '@/lib/tokens/pulseSocialLinks';
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

type GlyphKey = keyof typeof PULSE_GLYPH;

const MS_PER_DAY = 86_400_000;

/** Row icon hit targets — slightly padded for readability and tap/click confidence. */
const iconHit = cn(
  'group inline-flex shrink-0 items-center justify-center gap-0.5',
  'border-0 bg-transparent px-1 py-0.5 shadow-none outline-none ring-0',
  'rounded-md text-fg-secondary hover:bg-white/[0.06] hover:text-fg-primary active:bg-white/[0.09]',
  'transition-colors duration-100 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70C0E8]/40 focus-visible:ring-offset-0',
);

function statNumberClsFor(_glyphPx: number) {
  return 'ml-px font-sans text-xs leading-none tracking-tight text-fg-secondary';
}

type TwitterPreviewData =
  | { type: 'tweet'; html: string; author: string; authorUrl: string }
  | { type: 'profile'; handle: string; profileUrl: string };

function stripTwitterHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
      const r = await fetch(`/api/twitter-preview?url=${encodeURIComponent(url)}`);
      if (r.ok) {
        const json = (await r.json()) as Partial<TwitterPreviewData> & { error?: string };
        if (json && !json.error && (json.type === 'tweet' || json.type === 'profile')) {
          setData(json as TwitterPreviewData);
        }
      }
    } catch {
      /** Network/abort — popover falls back to "Open on X" link. */
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
          className="pointer-events-auto absolute left-1/2 top-[calc(100%+10px)] z-50 w-[260px] -translate-x-1/2 rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-panel"
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
          ) : data?.type === 'tweet' ? (
            <TwitterTweetPreview data={data} />
          ) : data?.type === 'profile' ? (
            <TwitterProfilePreview data={data} />
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-accent-primary hover:underline"
            >
              Open on X →
            </a>
          )}
        </div>
      ) : null}
    </span>
  );
}

function TwitterXBadge() {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[11px] font-bold leading-none text-accent-primary"
      aria-hidden
    >
      𝕏
    </span>
  );
}

function TwitterProfilePreview({
  data,
}: {
  data: Extract<TwitterPreviewData, { type: 'profile' }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TwitterXBadge />
        <span className="text-xs font-medium text-fg-primary">@{data.handle}</span>
      </div>
      <a
        href={data.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-primary hover:underline"
      >
        See profile on X →
      </a>
    </div>
  );
}

function TwitterTweetPreview({
  data,
}: {
  data: Extract<TwitterPreviewData, { type: 'tweet' }>;
}) {
  const raw = stripTwitterHtml(data.html ?? '');
  const text = raw.slice(0, 120);
  const author = data.author?.trim() || 'Tweet';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TwitterXBadge />
        <span className="text-xs font-medium text-fg-primary">{author}</span>
      </div>
      {text ? (
        <p className="text-xs leading-snug text-fg-secondary">
          {text}
          {raw.length > 120 ? '…' : ''}
        </p>
      ) : null}
      {data.authorUrl ? (
        <a
          href={data.authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent-primary hover:underline"
        >
          See on X →
        </a>
      ) : null}
    </div>
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
        title={label}
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
        title="X community"
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
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(iconHit, 'pl-0 pr-0')}
    >
      <PulseGlyphMask name={glyph} size={glyphPx} />
      <span className={statNumberClsFor(glyphPx)}>{stat}</span>
    </Link>
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
    <Link
      href={href}
      aria-label="Holders"
      title="Holders"
      className={cn(iconHit, 'pl-0 pr-0')}
    >
      <PulseLuminanceGlyph src={PULSE_BRAND_SRC.communities} size={glyphPx} />
      <span className={statNumberClsFor(glyphPx)}>{stat}</span>
    </Link>
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
        title="Instagram"
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className={iconHit}
      >
        <PulseLuminanceGlyph src={src} size={glyphPx} />
      </a>
    </PulseRichHover>
  );
}

export function PulseRowSocialStrip({
  bundle,
  compact,
  traits,
  glyphSize,
}: {
  bundle: PulseTokenBundle;
  compact?: boolean;
  traits?: { cashback: boolean; feeShare: boolean; agent: boolean };
  glyphSize?: number;
}) {
  const sx = glyphSize ?? 24;
  const followerGlyph = Math.max(12, Math.round(sx * 0.55));
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

  const showFollowerRow = profile?.handle && profile.url && twFollowers != null && twFollowers > 0;

  const txLabel = txns != null ? formatNumber(txns, { decimals: 0 }) : '0';
  const crownDen = holders != null && holders > 0 ? String(holders) : '0';

  const tweetUrl = model.twitterTweet?.url;
  const tweetStale = tweetUrl ? isTweetOlderThan(tweetUrl, MS_PER_DAY) : null;

  const pumpUrl = model.pumpFunUrl;

  return (
    <div className={cn('min-w-0 font-sans', compact ? 'mt-0.5' : 'mt-1')}>
      <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto overflow-y-hidden overscroll-x-contain py-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profile?.url ? (
          <TwitterLinkHover url={profile.url}>
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Creator profile on X (@${profile.handle?.replace(/^@/, '') ?? 'unknown'})`}
              title={`Creator profile on X${profile.handle ? ` (@${profile.handle.replace(/^@/, '')})` : ''}`}
              className={iconHit}
            >
              <PulseGlyphMask name="xLogo" size={sx} />
            </a>
          </TwitterLinkHover>
        ) : null}

        {tweetUrl ? (
          <TwitterLinkHover url={tweetUrl}>
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={tweetStale === true ? 'Post on X (over 24h old)' : 'Post on X'}
              title={tweetStale === true ? 'Linked post on X — over 24h old' : 'Linked post on X'}
              className={iconHit}
            >
              <MessageSquare
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  tweetStale === true && 'text-signal-warn',
                )}
                strokeWidth={2}
                aria-hidden
              />
            </a>
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
          <a
            href={model.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
            title="Website"
            className={iconHit}
          >
            <PulseGlyphMask name="globe" size={sx} />
          </a>
        ) : null}

        {pumpUrl ? (
          pumpLive ? (
            <PulseRichHover panel={<PumpFunHoverPanel bundle={bundle} pumpUrl={pumpUrl} />}>
              <a
                href={pumpUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TON launchpad (live)"
                title="TON launchpad livestream"
                className={iconHit}
              >
                <PulseGlyphMask
                  name="pump"
                  size={sx}
                  variant="natural"
                  className="drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                />
              </a>
            </PulseRichHover>
          ) : (
            <a
              href={pumpUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TON launchpad"
              title="TON launchpad"
              className={iconHit}
            >
              <PulseGlyphMask name="pump" size={sx} variant="mono" />
            </a>
          )
        ) : null}

        {agent ? (
          <PulseRichHover wide panel={<AgentHoverPanel bundle={bundle} />}>
            <Link href={tokenPath} aria-label="Agent details" title="Agent" className={iconHit}>
              <PulseGlyphMask name="agent" size={sx} variant="natural" />
            </Link>
          </PulseRichHover>
        ) : null}

        {cashback ? (
          <span
            className={cn(iconHit, 'pointer-events-none cursor-default')}
            title="Cashback"
            aria-label="Cashback token"
            role="img"
          >
            <PulseGlyphMask name="cashback" size={sx} variant="natural" />
          </span>
        ) : null}

        {feeShare ? (
          <PulseRichHover wide panel={<FeeShareHoverPanel bundle={bundle} />}>
            <span
              className={cn(iconHit, 'cursor-default')}
              title="Fee shared - hover for breakdown"
              aria-label="Creator fee / revenue share"
              role="button"
            >
              <PulseGlyphMask name="feeShare" size={sx} variant="natural" />
            </span>
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
      </div>

      {showFollowerRow ? (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <a
            href={profile!.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[#5ebbff] hover:text-[#7dd3fc] hover:underline"
          >
            @{profile!.handle!.replace(/^@/, '')}
          </a>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5ebbff]">
            <PulseGlyphMask name="profile" size={followerGlyph} />
            <span className="tabular-nums">{formatNumber(twFollowers, { compact: true })}</span>
          </span>
        </div>
      ) : profile?.handle && profile.url ? (
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#70C0E8] hover:text-[#9dd8f5] hover:underline"
        >
          <span className="inline-flex text-white opacity-95 hover:text-[#70C0E8]">
            <PulseGlyphMask name="xLogo" size={followerGlyph} />
          </span>
          @{profile.handle.replace(/^@/, '')}
        </a>
      ) : null}
    </div>
  );
}
