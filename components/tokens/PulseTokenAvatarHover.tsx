'use client';

import { useCallback, useMemo, useState } from 'react';
import { Camera, EyeOff, UserRoundX } from 'lucide-react';
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

export function PulseTokenAvatarHover({
  bundle,
  size,
  showRing,
  launchpadChrome,
  columnId,
  className,
}: {
  bundle: PulseTokenBundle;
  size: number;
  showRing?: boolean;
  launchpadChrome?: LaunchpadAvatarChrome | null;
  columnId?: PulseColumnId;
  className?: string;
}) {
  const { token } = bundle;
  const imageUrl = token.image_url;
  const hideToken = usePulseHiddenMintsStore((s) => s.hideToken);
  const blacklistDev = usePulseHiddenMintsStore((s) => s.blacklistDev);
  const blacklistTwitter = usePulseHiddenMintsStore((s) => s.blacklistTwitter);
  const [hovered, setHovered] = useState(false);

  const twitterHandle = useMemo(
    () => normalizePulseTwitterHandle(token.twitter_handle),
    [token.twitter_handle],
  );

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

  const openLens = useCallback(() => {
    if (!imageUrl) return;
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(absImageUrl(imageUrl))}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [imageUrl]);

  const onAction = (key: ActionKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (key === 'mint') hideToken(token.mint);
    else if (key === 'dev' && token.creator_wallet) blacklistDev(token.creator_wallet);
    else if (key === 'twitter' && twitterHandle) blacklistTwitter(twitterHandle);
  };

  const previewPx = Math.min(280, Math.max(size * 2.4, 160));
  const actionBtnPx = Math.max(16, Math.min(20, Math.round(size * 0.34)));
  const iconPx = Math.max(10, Math.round(actionBtnPx * 0.58));

  return (
    <div
      className={cn('group/pulseAv relative flex items-center overflow-visible', className)}
      data-row-click-skip="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'flex shrink-0 flex-col gap-0.5 overflow-hidden transition-all duration-150',
          hovered ? 'mr-0.5 w-[18px] opacity-100' : 'mr-0 w-0 opacity-0',
        )}
      >
        {actions.map((action) => (
          <Tooltip key={action.key} delayDuration={120}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={action.disabled}
                aria-label={action.title}
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
        ))}
      </div>

      <div className="relative shrink-0">
        <PulseTokenAvatar
          bundle={bundle}
          size={size}
          showRing={showRing}
          launchpadChrome={launchpadChrome}
          columnId={columnId}
        />

        {imageUrl ? (
          <button
            type="button"
            aria-label="Search image on Google Lens"
            title="Search image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openLens();
            }}
            className={cn(
              'absolute inset-0 z-[18] flex items-center justify-center rounded-lg transition-[background-color,opacity] duration-150',
              hovered ? 'bg-black/40' : 'bg-transparent',
            )}
          >
            <Camera
              className={cn(
                'text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition-opacity duration-150',
                hovered ? 'opacity-100' : 'opacity-0',
              )}
              style={{ width: Math.max(14, Math.round(size * 0.28)), height: Math.max(14, Math.round(size * 0.28)) }}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {hovered && imageUrl ? (
        <div
          className="pointer-events-none absolute left-0 top-full z-[90] mt-2 overflow-hidden rounded-lg border border-white/[0.12] bg-[#0a0c10] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.9)]"
          style={{ width: previewPx }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="block h-auto w-full object-cover"
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}
