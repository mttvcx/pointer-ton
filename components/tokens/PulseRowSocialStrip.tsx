'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { getPulseSocialModel, isTweetOlderThan } from '@/lib/tokens/pulseSocialLinks';
import { twitterFollowersFromBundle } from '@/lib/tokens/columnPresetModel';
import type { PulseTokenBundle } from '@/types/tokens';
import { isPumpLiveFromMetadata } from '@/lib/tokens/pulseRichMetadata';
import { PulseGlyphMask, PulseLuminanceGlyph, PULSE_GLYPH, PULSE_INSTAGRAM_SRC, PULSE_BRAND_SRC } from '@/components/tokens/PulseGlyphMask';
import { formatNumber } from '@/lib/utils/formatters';
import {
  PulseRichHover,
  TwitterProfileHoverPanel,
  BrandLinkHoverPanel,
  FeeShareHoverPanel,
  AgentHoverPanel,
  PumpFunHoverPanel,
} from '@/components/tokens/PulseRichPopovers';

type GlyphKey = keyof typeof PULSE_GLYPH;

const MS_PER_DAY = 86_400_000;

/** Tight hit targets; gap-0 so icon + stat read as one unit (Axiom-style). */
const iconHit = cn(
  'group inline-flex shrink-0 items-center justify-center gap-0',
  'border-0 bg-transparent p-0 shadow-none outline-none ring-0',
  'transition-[filter,opacity] duration-100 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70C0E8]/40 focus-visible:ring-offset-0',
);

function statNumberClsFor(glyphPx: number) {
  return cn(
    'ml-px translate-y-px font-sans tabular-nums leading-none tracking-tight text-white/95 group-hover:text-[#70C0E8]',
    'font-medium',
    glyphPx >= 26 ? 'text-[12px]' : glyphPx >= 22 ? 'text-[11px]' : 'text-[10px]',
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

function InternalGlyphLink({
  href,
  label,
  glyph,
  glyphPx,
}: {
  href: string;
  label: string;
  glyph: GlyphKey;
  glyphPx: number;
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={iconHit}>
      <PulseGlyphMask name={glyph} size={glyphPx} />
    </Link>
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
      <div className="flex min-w-0 flex-nowrap items-center gap-x-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profile?.url ? (
          <PulseRichHover
            wide
            panel={<TwitterProfileHoverPanel bundle={bundle} model={model} followers={twFollowers} />}
          >
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Creator profile on X"
              title="Creator profile on X"
              className={iconHit}
            >
              <PulseGlyphMask name="profile" size={sx} />
            </a>
          </PulseRichHover>
        ) : null}

        {tweetUrl ? (
          <WithHoverTooltip
            previewTitle="Linked post on X"
            previewSubtitle={
              tweetStale === true
                ? 'Tweet over 24h old (by post ID time)'
                : 'Opens the linked post'
            }
          >
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Post on X"
              title="Post on X"
              className={iconHit}
            >
              <PulseGlyphMask
                name="feather"
                size={sx}
                variant="natural"
                className={
                  tweetStale === true
                    ? '[filter:hue-rotate(-35deg)_saturate(1.45)_brightness(0.92)_contrast(1.08)]'
                    : undefined
                }
              />
            </a>
          </WithHoverTooltip>
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

        <InternalGlyphLink href={tokenPath} label="Token details" glyph="search" glyphPx={sx} />

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
