'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { extractTwitterHandle } from '@/lib/utils/extractTwitterHandle';
import { getPulseSocialModel, tweetAgeBand, tweetFeatherColorClass, ensureBrowserUrl, resolveDisplayWebsite, twitterHandleFromProfileUrl } from '@/lib/tokens/pulseSocialLinks';
import { usePrefetchTwitterProfileOnVisible } from '@/lib/hooks/usePrefetchTwitterProfileOnVisible';
import { useTwitterProfile } from '@/lib/hooks/useTwitterProfile';
import { useCoinCommunity } from '@/lib/hooks/useCoinCommunity';
import { usePrefetchCoinCommunityOnVisible } from '@/lib/hooks/usePrefetchCoinCommunityOnVisible';
import { enqueueCoinCommunityPrefetch } from '@/lib/communities/coinCommunityPrefetchQueue';
import { twitterFollowersFromBundle } from '@/lib/tokens/columnPresetModel';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  formatDevMigrateSlash,
  devMigrateFractionFromBundle,
  proTradersCountFromBundle,
} from '@/lib/tokens/pulseStripHoverMetrics';
import {
  PulseGlyphMask,
  PulseLuminanceGlyph,
  PULSE_BRAND_SRC,
  PULSE_GLYPH,
  PULSE_INSTAGRAM_SRC,
} from '@/components/tokens/PulseGlyphMask';
import { formatNumber } from '@/lib/utils/formatters';
import {
  PulseRichHover,
  BrandLinkHoverPanel,
  FeeShareHoverPanel,
  AgentHoverPanel,
  PulseCashbackCompactHover,
  PulseCompactHoverAbove,
  TelegramCompactHover,
  TwitterProfileHoverTrigger,
  TwitterTweetHoverTrigger,
  WebsiteGlobeCompactHover,
} from '@/components/tokens/PulseRichPopovers';
import { PulseHeaderSocialIcon } from '@/components/tokens/PulseHeaderSocialIcon';
import { CoinCommunityHoverTrigger } from '@/components/tokens/CoinCommunityHover';
import { coinCommunityWebUrl } from '@/lib/communities/coinCommunity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';

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

/** Linked X post — Axiom feather glyph + standard tweet HoverCard. */
function TweetStripLink({
  url,
  sx,
  linkClassName,
}: {
  url: string;
  sx: number;
  linkClassName?: string;
}) {
  const leafSize = Math.max(12, Math.round(sx * 0.72));
  const ageBand = tweetAgeBand(url);
  const ariaBand =
    ageBand === 'fresh'
      ? 'within the past hour'
      : ageBand === 'warm'
        ? '1–3 hours old'
        : ageBand === 'stale'
          ? 'over 3 hours old'
          : 'unknown age';

  return (
    <TwitterTweetHoverTrigger url={url}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Post on X (${ariaBand})`}
        className={cn(iconHit, 'relative z-[2] min-w-6', linkClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        <PulseLuminanceGlyph
          src={PULSE_GLYPH.feather}
          size={leafSize}
          className={tweetFeatherColorClass(url)}
        />
      </a>
    </TwitterTweetHoverTrigger>
  );
}

/**
 * Row icon hit targets — Axiom-style tight cluster (no per-icon hover fill).
 */
const iconHit = cn(
  'group inline-flex h-6 shrink-0 items-center justify-center gap-1',
  'border-0 bg-transparent px-0.5 shadow-none outline-none ring-0',
  'rounded-md',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-0',
);

/** Icons only — 100% opaque gray (numbers stay white via {@link statNumberClsFor}). */
const pulseStripIconTone = 'text-fg-secondary';

function statNumberClsFor(_glyphPx: number) {
  return 'ml-0 font-sans text-[13px] font-semibold leading-none tracking-tight text-fg-primary';
}

function StripGlyph({ children }: { children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 opacity-100', pulseStripIconTone)}>{children}</span>
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
  return (
    <PulseCompactHoverAbove
      placement="below"
      openDelayMs={90}
      closeDelayMs={160}
      content={
        <>
          <p className="text-[11px] font-semibold leading-snug text-fg-primary">{previewTitle}</p>
          {previewSubtitle ? (
            <p className="mt-0.5 text-[10px] leading-snug text-fg-muted">{previewSubtitle}</p>
          ) : null}
        </>
      }
    >
      {children}
    </PulseCompactHoverAbove>
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
        <StripGlyph>
          <PulseGlyphMask name={glyph} size={glyphPx} />
        </StripGlyph>
      </a>
    </WithHoverTooltip>
  );
}

/** Stat glyph + compact hover label (Axiom parity). */
function PulseGlyphStatHoverCard({
  href,
  ariaLabel,
  hoverTitle,
  glyph,
  stat,
  glyphPx,
  placement = 'above',
}: {
  href: string;
  ariaLabel: string;
  hoverTitle: string;
  glyph: GlyphKey;
  stat: ReactNode;
  glyphPx: number;
  placement?: 'above' | 'below';
}) {
  return (
    <PulseCompactHoverAbove
      placement={placement}
      openDelayMs={90}
      closeDelayMs={90}
      content={
        <p className="text-[11px] font-semibold leading-none text-fg-primary">{hoverTitle}</p>
      }
    >
      <Link
        href={href}
        aria-label={ariaLabel}
        data-row-click-skip="true"
        className={cn(iconHit, 'pl-0 pr-0')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <StripGlyph>
          <PulseGlyphMask name={glyph} size={glyphPx} />
        </StripGlyph>
        <span className={statNumberClsFor(glyphPx)}>{stat}</span>
      </Link>
    </PulseCompactHoverAbove>
  );
}

/**
 * Coin Communities entry point — the double-avatar glyph now opens the token's
 * per-token community (replaces the dead X Communities link). Hover reveals a rich
 * preview (members / posts / recent messages); click opens the community page.
 */
function CoinCommunityStatLink({
  mint,
  glyphPx,
}: {
  mint: string;
  glyphPx: number;
}) {
  const queryClient = useQueryClient();
  const { data } = useCoinCommunity(mint);
  const memberStat =
    data?.memberCount != null && Number.isFinite(data.memberCount)
      ? formatNumber(data.memberCount, { decimals: 0 })
      : '0';

  return (
    <CoinCommunityHoverTrigger mint={mint}>
      <a
        href={coinCommunityWebUrl(mint)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Coin Community members"
        className={cn(iconHit, 'pl-0 pr-0')}
        onPointerEnter={() => enqueueCoinCommunityPrefetch(queryClient, mint)}
      >
        <StripGlyph>
          <PulseLuminanceGlyph src={PULSE_BRAND_SRC.communities} size={glyphPx} />
        </StripGlyph>
        <span className={statNumberClsFor(glyphPx)}>{memberStat}</span>
      </a>
    </CoinCommunityHoverTrigger>
  );
}

function ExternalInstagramLink({
  href,
  previewTitle,
  previewSubtitle,
  glyphPx,
  linkClassName,
}: {
  href: string;
  previewTitle: string;
  previewSubtitle?: string;
  glyphPx: number;
  linkClassName?: string;
}) {
  return (
    <WithHoverTooltip previewTitle={previewTitle} previewSubtitle={previewSubtitle}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className={cn(iconHit, linkClassName)}
      >
        {/* Same luminance-mask treatment as other strip glyphs — avoids baked black tiles. */}
        <StripGlyph>
          <PulseLuminanceGlyph src={PULSE_INSTAGRAM_SRC} size={glyphPx} />
        </StripGlyph>
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
  linkClassName,
}: {
  href: string;
  label: string;
  src: string;
  panelTitle: string;
  glyphPx: number;
  linkClassName?: string;
}) {
  return (
    <PulseRichHover panel={<BrandLinkHoverPanel url={href} title={panelTitle} />} wide={false}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(iconHit, linkClassName)}
      >
        <StripGlyph>
          <PulseLuminanceGlyph src={src} size={glyphPx} />
        </StripGlyph>
      </a>
    </PulseRichHover>
  );
}

export function PulseRowSocialStrip({
  bundle,
  compact,
  traits,
  glyphSize,
  profileGlyphSize,
  showTxCount = true,
  showDevWallet = true,
  showHoldersCommunity = true,
  showProTradersStat = true,
  showDevCrownStat = true,
  /** Fallback X search when metadata has no search URL (token page header). */
  fallbackXSearchQuery,
  showTwitterFooter = true,
  inlineHeader = false,
  /** Pulse table rows: stack icon row / @handle row with spacing for metric pills below (Axiom-style). */
  pulseBoard = false,
  chain = 'sol',
}: {
  bundle: PulseTokenBundle;
  compact?: boolean;
  traits?: { cashback: boolean; feeShare: boolean; agent: boolean };
  glyphSize?: number;
  /** Token header: profile outline PNG renders slightly larger than sibling glyphs. */
  profileGlyphSize?: number;
  showTxCount?: boolean;
  showDevWallet?: boolean;
  showHoldersCommunity?: boolean;
  showProTradersStat?: boolean;
  showDevCrownStat?: boolean;
  fallbackXSearchQuery?: string | null;
  showTwitterFooter?: boolean;
  inlineHeader?: boolean;
  pulseBoard?: boolean;
  chain?: AppChainId;
}) {
  // Default ~25% larger than the previous 20/24 to match Axiom's icon weight.
  // Token detail header uses explicit glyphSize (28px) for Axiom parity.
  const sx = glyphSize ?? (inlineHeader ? 20 : 24);
  const profileSx = profileGlyphSize ?? (inlineHeader ? sx + 4 : sx);
  const hit = cn(
    iconHit,
    inlineHeader && 'h-7 min-w-[26px] justify-center px-0.5',
  );
  const headerLinkCls = inlineHeader ? 'h-7 min-w-[28px] justify-center px-1' : undefined;
  const followerGlyph = Math.max(14, Math.round(sx * 0.55));
  const rowFields = usePulseDisplayPrefsStore((s) => s.rowFields);
  const model = useMemo(() => getPulseSocialModel(bundle), [bundle]);
  const twFollowers = useMemo(() => twitterFollowersFromBundle(bundle), [bundle]);
  const tokenPath = `/token/${encodeURIComponent(bundle.token.mint)}`;
  const snapshot = bundle.snapshot;
  const holders = snapshot?.holder_count;
  const txns = snapshot?.txns_1h ?? snapshot?.txns_5m ?? null;

  const cashback = traits?.cashback ?? false;
  const feeShare = traits?.feeShare ?? false;
  const agent = traits?.agent ?? false;

  const profile = model.twitterProfile;

  const twitterProfileUrl =
    profile?.url ?? twitterProfileUrlFromHandleField(bundle.token.twitter_handle);
  const handleFromToken = bundle.token.twitter_handle
    ? extractTwitterHandle(bundle.token.twitter_handle)
    : '';
  const twitterDisplayHandle =
    profile?.handle?.replace(/^@/, '') ||
    (handleFromToken !== '' ? handleFromToken : null) ||
    (profile?.url ? twitterHandleFromProfileUrl(profile.url) ?? null : null) ||
    (twitterProfileUrl ? twitterHandleFromProfileUrl(twitterProfileUrl) ?? null : null);

  const { data: twitterProfile } = useTwitterProfile(twitterDisplayHandle, {
    enabled: Boolean(twitterDisplayHandle),
  });
  const followerCount = twFollowers ?? twitterProfile?.followerCount ?? null;

  const prefetchTwitterRef = usePrefetchTwitterProfileOnVisible(twitterDisplayHandle);
  const prefetchCommunityRef = usePrefetchCoinCommunityOnVisible(
    showHoldersCommunity ? bundle.token.mint : null,
  );
  const rowPrefetchRef = useCallback(
    (node: HTMLElement | null) => {
      prefetchTwitterRef(node);
      prefetchCommunityRef(node);
    },
    [prefetchTwitterRef, prefetchCommunityRef],
  );

  const showHandleFooter =
    showTwitterFooter &&
    Boolean(twitterDisplayHandle) &&
    Boolean(twitterProfileUrl) &&
    (!pulseBoard || rowFields.twitterHandle);

  const showFollowersInFooter =
    showHandleFooter &&
    followerCount != null &&
    followerCount > 0 &&
    (!pulseBoard || rowFields.twitterFollowers);

  const txLabel = txns != null ? formatNumber(txns, { decimals: 0 }) : '—';
  const devMigrateFrac = useMemo(() => devMigrateFractionFromBundle(bundle), [bundle]);
  const crownSlashDisplay = formatDevMigrateSlash(devMigrateFrac);
  const proTradersCount = useMemo(() => proTradersCountFromBundle(bundle), [bundle]);
  const proTradersLabel =
    proTradersCount != null ? formatNumber(proTradersCount, { decimals: 0, compact: proTradersCount >= 1000 }) : '—';

  const tweetUrl = model.twitterTweet?.url;
  const fallbackXSearch =
    fallbackXSearchQuery?.trim() &&
    `https://x.com/search?q=${encodeURIComponent(fallbackXSearchQuery.trim())}`;

  const devWalletAddr = bundle.token.creator_wallet;
  const solscanDevWalletUrl = devWalletAddr
    ? `https://solscan.io/account/${encodeURIComponent(devWalletAddr)}`
    : null;

  const xSearchUrl = model.twitterSearch?.url ?? fallbackXSearch ?? null;
  const displayWebsite = resolveDisplayWebsite(model.website);

  if (inlineHeader) {
    const headerHoverPlacement = 'below' as const;

    return (
      <div ref={rowPrefetchRef} className="inline-flex min-w-0 items-center font-sans">
        <div className="flex h-7 min-w-0 flex-nowrap items-center gap-1 overflow-visible py-0">
          {twitterProfileUrl && twitterDisplayHandle ? (
            <TwitterProfileHoverTrigger
              handle={twitterDisplayHandle}
              side="bottom"
              align="start"
              sideOffset={0}
            >
              <a
                href={twitterProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Creator profile on X (@${twitterDisplayHandle})`}
                className={hit}
              >
                <PulseHeaderSocialIcon kind="profile" size={profileSx} />
              </a>
            </TwitterProfileHoverTrigger>
          ) : null}

          {tweetUrl ? (
            <TweetStripLink url={tweetUrl} sx={sx} linkClassName={hit} />
          ) : null}

          {model.telegram ? (
            <TelegramCompactHover url={model.telegram} placement={headerHoverPlacement}>
              <a
                href={model.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className={hit}
              >
                <PulseHeaderSocialIcon kind="telegram" size={sx} />
              </a>
            </TelegramCompactHover>
          ) : null}

          {displayWebsite ? (
            <WebsiteGlobeCompactHover
              url={displayWebsite}
              tokenCreatedAt={bundle.token.created_at}
              placement={headerHoverPlacement}
            >
              <a
                href={displayWebsite}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${displayWebsite}`}
                className={hit}
              >
                <PulseHeaderSocialIcon kind="globe" size={sx} className="text-inherit" />
              </a>
            </WebsiteGlobeCompactHover>
          ) : null}

          {xSearchUrl ? (
            <PulseCompactHoverAbove
              placement={headerHoverPlacement}
              content={
                <>
                  <p className="text-[11px] font-bold leading-none text-white">Search on X</p>
                  <p className="mt-1.5 max-w-[12rem] truncate text-[9px] leading-snug text-white/45">
                    {fallbackXSearchQuery?.trim() || 'Token search'}
                  </p>
                </>
              }
            >
              <a
                href={xSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Search on X"
                className={hit}
              >
                <PulseHeaderSocialIcon kind="search" size={sx} className="text-inherit" />
              </a>
            </PulseCompactHoverAbove>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowPrefetchRef}
      className={cn(
        'min-w-0 font-sans',
        inlineHeader && 'inline-flex min-w-0 items-center',
        pulseBoard
          ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-visible'
          : compact
            ? 'mt-0'
            : 'mt-1',
      )}
    >
      <div
        className={cn(
          'relative z-[2] flex h-6 min-w-0 flex-nowrap items-center overflow-x-auto overflow-y-visible overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'gap-1',
        )}
      >
        {twitterProfileUrl && twitterDisplayHandle ? (
          /**
           * Creator profile icon — opens the full {@link TwitterProfileHoverCard}
           * via Radix HoverCard. No `title=` / Radix tooltip; the hover card *is*
           * the surface. `aria-label` stays for screen readers (does not render
           * as a browser tooltip on focusable anchors).
           */
          <TwitterProfileHoverTrigger handle={twitterDisplayHandle}>
            <a
              href={twitterProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Creator profile on X (@${twitterDisplayHandle})`}
              className={hit}
            >
              <PulseHeaderSocialIcon kind="profile" size={sx} />
            </a>
          </TwitterProfileHoverTrigger>
        ) : null}

        {tweetUrl ? (
          <TweetStripLink url={tweetUrl} sx={sx} linkClassName={hit} />
        ) : null}

        {model.twitterSearch?.url ? (
          <ExternalGlyphLink
            href={model.twitterSearch.url}
            label="Search on X"
            glyph="xLogo"
            previewTitle="X search or query"
            previewSubtitle="Search, hashtag, or explore link from metadata"
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : fallbackXSearch ? (
          <ExternalGlyphLink
            href={fallbackXSearch}
            label="Search on X"
            glyph="xLogo"
            previewTitle="Search on X"
            previewSubtitle={fallbackXSearchQuery ?? ''}
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : null}

        {model.telegram ? (
          <TelegramCompactHover url={model.telegram}>
            <a
              href={model.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className={iconHit}
            >
              <StripGlyph>
                <PulseGlyphMask name="telegram" size={sx} />
              </StripGlyph>
            </a>
          </TelegramCompactHover>
        ) : null}

        {model.instagram ? (
          <ExternalInstagramLink
            href={model.instagram}
            previewTitle="Instagram"
            previewSubtitle={model.instagram.replace(/^https?:\/\//i, '').slice(0, 52)}
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : null}

        {model.github ? (
          <BrandIconLink
            href={model.github}
            label="GitHub"
            src={PULSE_BRAND_SRC.github}
            panelTitle="GitHub"
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : null}
        {model.youtube ? (
          <BrandIconLink
            href={model.youtube}
            label="YouTube"
            src={PULSE_BRAND_SRC.youtube}
            panelTitle="YouTube"
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : null}
        {model.tiktok ? (
          <BrandIconLink
            href={model.tiktok}
            label="TikTok"
            src={PULSE_BRAND_SRC.tiktok}
            panelTitle="TikTok"
            glyphPx={sx}
            linkClassName={headerLinkCls}
          />
        ) : null}

        {model.website ? (
          (() => {
            const websiteUrl = resolveDisplayWebsite(model.website);
            if (!websiteUrl) return null;

            return (
              <WebsiteGlobeCompactHover url={websiteUrl} tokenCreatedAt={bundle.token.created_at}>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${websiteUrl}`}
                  className={hit}
                >
                  <StripGlyph>
                    <PulseGlyphMask name="globe" size={sx} />
                  </StripGlyph>
                </a>
              </WebsiteGlobeCompactHover>
            );
          })()
        ) : null}

        {/* Pump.fun glyph removed from strip — already available as the clickable corner badge on the avatar ring. */}

        {agent ? (
          <PulseRichHover wide panel={<AgentHoverPanel bundle={bundle} />}>
            <Link href={tokenPath} aria-label="Pump agent mode — hover for controls" className={hit}>
              <PulseLuminanceGlyph
                src={PULSE_GLYPH.agent}
                size={sx}
                className="text-signal-positive"
              />
            </Link>
          </PulseRichHover>
        ) : null}

        {cashback ? (
          <PulseCashbackCompactHover>
            <span
              className={cn(hit, 'pointer-events-none cursor-default')}
              aria-label="Cashback token"
              role="img"
            >
              <StripGlyph>
                <PulseGlyphMask name="cashback" size={sx} />
              </StripGlyph>
            </span>
          </PulseCashbackCompactHover>
        ) : null}

        {feeShare ? (
          <PulseRichHover wide panel={<FeeShareHoverPanel bundle={bundle} />}>
            <span
              className={cn(hit, 'cursor-default')}
              aria-label="Pump fee-share / rebates — hover for breakdown"
              role="button"
            >
              <StripGlyph>
                <PulseGlyphMask name="feeShare" size={sx} />
              </StripGlyph>
            </span>
          </PulseRichHover>
        ) : null}

        {showHoldersCommunity ? (
          <CoinCommunityStatLink mint={bundle.token.mint} glyphPx={sx} />
        ) : null}

        {showProTradersStat ? (
          <PulseGlyphStatHoverCard
            href={tokenPath}
            ariaLabel="Pro traders — hover for details, click for token page"
            hoverTitle="Pro Traders"
            glyph="trophy"
            stat={proTradersLabel}
            glyphPx={sx}
            placement={pulseBoard ? 'below' : 'above'}
          />
        ) : null}

        {showDevCrownStat ? (
          <PulseCompactHoverAbove
            placement={pulseBoard ? 'below' : 'above'}
            content={
              <>
                <p className="text-[12px] font-medium leading-tight text-white/90">
                  Dev Migrations/Created
                </p>
                <p className="mt-0.5 text-[10.5px] leading-tight text-white/40">
                  click to open in Solscan
                </p>
              </>
            }
          >
            <a
              href={solscanDevWalletUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Dev migrations / created — open on Solscan"
              data-row-click-skip="true"
              className={cn(hit, 'relative z-[2] pl-0 pr-0')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!solscanDevWalletUrl) e.preventDefault();
              }}
            >
              <StripGlyph>
                <PulseGlyphMask name="crown" size={sx} />
              </StripGlyph>
              <span className={statNumberClsFor(sx)}>{crownSlashDisplay}</span>
            </a>
          </PulseCompactHoverAbove>
        ) : null}

        {showDevWallet && devWalletAddr && !pulseBoard ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/wallet/${encodeURIComponent(devWalletAddr)}`}
                className="flex cursor-default items-center"
                aria-label={`Dev wallet ${devWalletAddr}`}
                data-row-click-skip="true"
              >
                <ChefHat
                  className="shrink-0 text-signal-warn"
                  style={{ width: sx, height: sx }}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            </TooltipTrigger>
            {/* Tooltip is the full address only — no "Dev wallet:" prefix. */}
            <TooltipContent className="font-mono">{devWalletAddr}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {showFollowersInFooter && twitterDisplayHandle ? (
        <div
          className={cn(
            /** Single line — scroll inside the text column when handle + stats are wide. */
            'flex h-4 min-w-0 max-w-full flex-nowrap items-center gap-x-2 overflow-x-auto overflow-y-hidden whitespace-nowrap',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            pulseBoard ? 'relative z-0 mt-0' : 'mt-0.5',
          )}
        >
          {/* @handle text — same profile HoverCard as the avatar icon above. */}
          <TwitterProfileHoverTrigger handle={twitterDisplayHandle}>
            <a
              href={twitterProfileUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 whitespace-nowrap text-[11px] font-medium text-[#5ebbff] hover:text-[#7dd3fc] hover:underline"
            >
              @{twitterDisplayHandle}
            </a>
          </TwitterProfileHoverTrigger>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-fg-primary/75">
            <span className="inline-flex shrink-0">
              <PulseHeaderSocialIcon kind="profile" size={followerGlyph} />
            </span>
            <span className="shrink-0 tabular-nums text-[#5ebbff]">
              {formatNumber(followerCount!, { compact: true })}
            </span>
          </span>
        </div>
      ) : showHandleFooter && twitterDisplayHandle ? (
        <TwitterProfileHoverTrigger handle={twitterDisplayHandle}>
          <a
            href={twitterProfileUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-medium text-[#70C0E8] hover:text-[#9dd8f5] hover:underline',
              pulseBoard ? 'mt-0' : 'mt-0.5',
            )}
          >
            <span className="inline-flex shrink-0">
              <PulseHeaderSocialIcon kind="profile" size={16} />
            </span>
            @{twitterDisplayHandle}
          </a>
        </TwitterProfileHoverTrigger>
      ) : null}
    </div>
  );
}
