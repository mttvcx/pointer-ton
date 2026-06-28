'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { EyeOff, UserRoundX } from 'lucide-react';
import { PulseTokenAvatar } from '@/components/tokens/PulseTokenAvatar';
import type { LaunchpadAvatarChrome } from '@/lib/tokens/launchpadAvatarChrome';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  normalizePulseTwitterHandle,
  usePulseHiddenMintsStore,
} from '@/store/pulseHiddenMints';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useReusedImageTokens } from '@/lib/hooks/useReusedImageTokens';
import { formatAgeShort, formatCompactUsd } from '@/lib/utils/formatters';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { resolvePulseTokenImageUrl } from '@/lib/tokens/pulseTokenImageUrl';
import { useUIStore } from '@/store/ui';

function absImageUrl(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (typeof window === 'undefined') return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

type ActionKey = 'mint' | 'dev' | 'twitter';

type HoverAction = {
  key: ActionKey;
  title: string;
  icon: 'eye' | 'dev' | 'twitter';
  disabled?: boolean;
};

function ReusedImageTokenRow({
  mint,
  symbol,
  name,
  imageUrl,
  createdAt,
  marketCapUsd,
  nowMs,
  onNavigate,
}: {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
  marketCapUsd: number | null;
  nowMs: number;
  onNavigate: (mint: string) => void;
}) {
  const label = symbol?.trim() || name?.trim() || mint.slice(0, 6);

  return (
    <button
      type="button"
      data-row-click-skip="true"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onNavigate(mint);
      }}
      className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-[#11151c] px-2 py-1.5 text-left transition hover:border-white/[0.14] hover:bg-[#161b24]"
    >
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-[#0f1419] ring-1 ring-white/[0.08]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-tight text-white/95">{label}</p>
        <p className="text-[10px] leading-tight text-white/45">{formatAgeShort(createdAt, nowMs)}</p>
      </div>
      <p className="shrink-0 tabular-nums text-[11px] font-medium text-[#70C0E8]">
        {formatCompactUsd(marketCapUsd)}
      </p>
    </button>
  );
}

export function PulseTokenAvatarHover({
  bundle,
  size,
  showRing,
  launchpadChrome,
  columnId,
  className,
  avatarImagePriority = false,
  ringPresentation,
  cornerBadgeEmphasis,
  showHoverActions = true,
}: {
  bundle: PulseTokenBundle;
  size: number;
  showRing?: boolean;
  launchpadChrome?: LaunchpadAvatarChrome | null;
  columnId?: PulseColumnId;
  className?: string;
  avatarImagePriority?: boolean;
  ringPresentation?: 'progress' | 'brand-full';
  cornerBadgeEmphasis?: 'default' | 'header';
  /** Pulse row hide/blacklist chips — off on compact surfaces if needed. */
  showHoverActions?: boolean;
}) {
  const router = useRouter();
  const nowMs = useLiveClock();
  const activeChain = useUIStore((s) => s.activeChain);
  const { token } = bundle;
  const imageUrl = resolvePulseTokenImageUrl(bundle, activeChain);
  const hideToken = usePulseHiddenMintsStore((s) => s.hideToken);
  const blacklistDev = usePulseHiddenMintsStore((s) => s.blacklistDev);
  const blacklistTwitter = usePulseHiddenMintsStore((s) => s.blacklistTwitter);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const twitterHandle = useMemo(
    () => normalizePulseTwitterHandle(token.twitter_handle),
    [token.twitter_handle],
  );

  const reusedQuery = useReusedImageTokens(imageUrl, token.mint, {
    enabled: hovered && Boolean(imageUrl),
  });
  const reusedTotal = reusedQuery.data?.total ?? 0;
  const reusedItems = reusedQuery.data?.items ?? [];

  /** Axiom order: Hide token → Blacklist dev → Blacklist Twitter profile */
  const actions = useMemo((): HoverAction[] => {
    const list: HoverAction[] = [{ key: 'mint', title: 'Hide token', icon: 'eye' }];
    list.push({
      key: 'dev',
      title: 'Blacklist dev',
      icon: 'dev',
      disabled: !token.creator_wallet,
    });
    list.push({
      key: 'twitter',
      title: 'Blacklist Twitter profile',
      icon: 'twitter',
      disabled: !twitterHandle,
    });
    return list;
  }, [token.creator_wallet, twitterHandle]);

  const onAction = (key: ActionKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (key === 'mint') hideToken(token.mint);
    else if (key === 'dev' && token.creator_wallet) blacklistDev(token.creator_wallet);
    else if (key === 'twitter' && twitterHandle) blacklistTwitter(twitterHandle);
  };

  const syncPanelPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, left: r.left });
  }, []);

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

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

  useEffect(() => {
    if (!hovered) return;
    syncPanelPos();
  }, [hovered, syncPanelPos]);

  const previewPx = Math.min(280, Math.max(size * 2.4, 160));
  const actionBtnPx = Math.max(16, Math.min(20, Math.round(size * 0.34)));
  const iconPx = Math.max(10, Math.round(actionBtnPx * 0.58));

  const resolvedPanelPos = (() => {
    if (panelPos) return panelPos;
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return null;
    const r = el.getBoundingClientRect();
    return { top: r.bottom + 8, left: r.left };
  })();

  const previewPanel =
    hovered && imageUrl && resolvedPanelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="pointer-events-auto fixed z-[260] overflow-hidden rounded-lg border border-white/[0.12] bg-[#0a0c10] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.9)]"
            style={{
              top: resolvedPanelPos.top,
              left: resolvedPanelPos.left,
              width: previewPx,
            }}
            data-row-click-skip="true"
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
          >
            <div className="relative block w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="block h-auto w-full object-cover"
                draggable={false}
              />
            </div>

            {reusedTotal > 0 ? (
              <div className="border-t border-white/[0.08] px-2.5 py-2">
                <p className="mb-1.5 text-[10px] font-medium text-white/45">
                  Reused Image Tokens ({reusedTotal})
                </p>
                <div className="flex max-h-[min(12rem,40vh)] flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                  {reusedItems.map((row) => (
                    <ReusedImageTokenRow
                      key={row.mint}
                      mint={row.mint}
                      symbol={row.symbol}
                      name={row.name}
                      imageUrl={row.image_url}
                      createdAt={row.created_at}
                      marketCapUsd={row.market_cap_usd}
                      nowMs={nowMs}
                      onNavigate={(mint) => router.push(`/token/${mint}`)}
                    />
                  ))}
                </div>
              </div>
            ) : reusedQuery.isFetching ? (
              <div className="border-t border-white/[0.08] px-2.5 py-2">
                <p className="text-[10px] text-white/35">Checking reused images…</p>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={anchorRef}
      className={cn('group/pulseAv relative flex items-center overflow-visible', className)}
      data-row-click-skip="true"
      data-popover-open={hovered ? 'true' : undefined}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'flex shrink-0 flex-col gap-0.5 transition-all duration-150',
          showHoverActions && hovered ? 'mr-0.5 w-[18px] opacity-100' : 'mr-0 w-0 opacity-0',
        )}
      >
        {showHoverActions
          ? actions.map((action) => (
          <Tooltip key={action.key} delayDuration={120}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={action.disabled}
                aria-label={action.title}
                data-row-click-skip="true"
                onClick={(e) => onAction(action.key, e)}
                className={cn(
                  'flex items-center justify-center rounded-[3px] border border-white/[0.12] bg-[#141820]/95 shadow-sm',
                  'transition hover:border-white/25 hover:bg-[#1a2030]',
                  'disabled:pointer-events-none disabled:opacity-30',
                  action.icon === 'dev'
                    ? 'text-[#5ebbff] hover:text-[#7dd3fc]'
                    : 'text-white/75 hover:text-white',
                )}
                style={{ width: actionBtnPx, height: actionBtnPx }}
              >
                {action.icon === 'dev' ? (
                  <UserRoundX style={{ width: iconPx, height: iconPx }} strokeWidth={2.25} aria-hidden />
                ) : (
                  <EyeOff style={{ width: iconPx, height: iconPx }} strokeWidth={2.25} aria-hidden />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              sideOffset={6}
              className="rounded-md border border-white/[0.08] bg-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-normal text-white/90 shadow-lg"
            >
              {action.title}
            </TooltipContent>
          </Tooltip>
            ))
          : null}
      </div>

      <div className="relative shrink-0">
        <PulseTokenAvatar
          bundle={bundle}
          size={size}
          showRing={showRing}
          launchpadChrome={launchpadChrome}
          columnId={columnId}
          ringPresentation={ringPresentation}
          cornerBadgeEmphasis={cornerBadgeEmphasis}
          imagePriority={avatarImagePriority}
        />

      </div>

      {previewPanel}
    </div>
  );
}
