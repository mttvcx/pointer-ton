'use client';

import { forwardRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { presetClass } from '@/lib/share/backgrounds';
import type { PnlSharePayload } from '@/lib/share/types';
import type { ShareOverlaySettings } from '@/lib/share/types';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatCompactUsd } from '@/lib/utils/formatters';

const ACCENT: Record<ShareOverlaySettings['accent'], string> = {
  teal: '#2dd4bf',
  purple: '#c084fc',
  blue: '#60a5fa',
  green: '#4ade80',
};

function avatarFromAddr(addr: string): { bg: string; label: string } {
  const seed = addr.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [178, 210, 265, 142];
  const h = hues[seed % hues.length];
  const initials = addr.slice(0, 2).toUpperCase();
  return { bg: `hsl(${h} 65% 42%)`, label: initials };
}

export const PnlShareCard = forwardRef<
  HTMLDivElement,
  {
    payload: PnlSharePayload;
    overlay: ShareOverlaySettings;
    backgroundId: ShareBackgroundPresetId;
    customImageSrc?: string | null;
    imagePan?: { x: number; y: number };
    imageZoom?: number;
    /** Primary flex number inside the accent box (includes unit). */
    amountPrimary?: string | null;
    videoSrc?: string | null;
    /** Disable video autoplay (export frame capture) */
    videoPaused?: boolean;
    className?: string;
  }
>(function PnlShareCard(
  {
    payload,
    overlay,
    backgroundId,
    customImageSrc,
    imagePan = { x: 0, y: 0 },
    imageZoom = 1,
    amountPrimary,
    videoSrc,
    videoPaused,
    className,
  },
  ref,
) {
  const accent = ACCENT[overlay.accent];
  const pos = payload.pnlUsd != null && payload.pnlUsd >= 0;
  const mainAmt =
    amountPrimary ??
    (payload.pnlUsd == null
      ? '—'
      : payload.pnlUsd >= 0
        ? `+${formatCompactUsd(payload.pnlUsd)}`
        : formatCompactUsd(payload.pnlUsd));
  const pctStr =
    payload.pnlPct == null
      ? '—'
      : `${payload.pnlPct >= 0 ? '+' : ''}${payload.pnlPct.toFixed(2)}%`;

  let pnlLine = '';
  if (overlay.pnlFormat === 'amount') pnlLine = mainAmt;
  else if (overlay.pnlFormat === 'pct') pnlLine = pctStr;
  else pnlLine = `${mainAmt} (${pctStr})`;

  const av = avatarFromAddr(payload.walletAddress);

  const align =
    overlay.overlayAlign === 'center'
      ? 'items-center text-center'
      : overlay.overlayAlign === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  return (
    <div
      ref={ref}
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_40px_120px_-48px_rgba(0,0,0,0.95)]',
        !customImageSrc && !videoSrc && presetClass(backgroundId),
        className,
      )}
    >
      {videoSrc ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          muted
          playsInline
          loop
          autoPlay={!videoPaused}
        />
      ) : null}

      {customImageSrc && !videoSrc ? (
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={customImageSrc}
            alt=""
            className="h-full w-full object-cover"
            style={{
              transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.55] via-black/35 to-black/25"
        style={{ opacity: Math.min(1, overlay.overlayOpacity + 0.12) }}
      />

      <div
        className={cn(
          'relative z-[1] flex h-full flex-col p-[5.5%]',
          align,
        )}
        style={{
          transform: `scale(${overlay.textScale})`,
          transformOrigin:
            overlay.overlayAlign === 'center'
              ? 'top center'
              : overlay.overlayAlign === 'right'
                ? 'top right'
                : 'top left',
        }}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/branding/logo-bird.svg"
              alt=""
              width={28}
              height={28}
              className="opacity-95 drop-shadow"
            />
            <span className="text-[13px] font-semibold tracking-wide text-white/90">pointer.</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
            Pointer Pro
          </span>
        </div>

        <div className={cn('mt-4 flex w-full max-w-[82%] flex-col gap-3', align)}>
          <div>
            <h2
              className="font-semibold uppercase tracking-tight text-white"
              style={{ fontSize: `clamp(22px, 4.6vw, 44px)` }}
            >
              {(payload.tokenTicker || 'TOKEN').replace(/^\$+/, '').slice(0, 18)}
            </h2>
            {overlay.showTokenName && payload.tokenName ? (
              <p className="mt-1 text-[13px] text-white/65">{payload.tokenName}</p>
            ) : null}
          </div>

          <div
            className="rounded-xl px-4 py-3 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.65)]"
            style={{
              backgroundColor: pos ? accent : '#fb7185',
              width: 'min(92%, 440px)',
            }}
          >
            <p
              className="font-mono font-bold tabular-nums text-[#05070c]"
              style={{ fontSize: `clamp(24px, 5vw, 44px)` }}
            >
              {mainAmt}
            </p>
          </div>

          <div className="space-y-1.5 text-[14px] leading-snug">
            <p style={{ color: pos ? accent : '#fda4af' }} className="font-semibold tabular-nums">
              PnL {pnlLine}
            </p>
            {!overlay.compactStats ? (
              <>
                <p className="text-white/80 tabular-nums">
                  Invested{' '}
                  {payload.investedUsd == null
                    ? '—'
                    : formatCompactUsd(payload.investedUsd)}
                </p>
                <p className="text-white/80 tabular-nums">
                  Position{' '}
                  {payload.positionUsd == null
                    ? '—'
                    : formatCompactUsd(payload.positionUsd)}
                </p>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex w-full items-end justify-between gap-3 pt-6">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white shadow-inner ring-1 ring-white/10"
              style={{ backgroundColor: av.bg }}
            >
              {av.label}
            </div>
            <div className="min-w-0">
              {overlay.showWalletLabel && payload.walletLabel ? (
                <p className="truncate text-[13px] font-semibold text-white">
                  {payload.walletLabel}
                </p>
              ) : null}
              {overlay.showWalletAddress ? (
                <p className="font-mono text-[11px] text-white/55">
                  {shortenAddress(payload.walletAddress, 5)}
                </p>
              ) : overlay.showWalletLabel && payload.walletLabel ? null : (
                <p className="truncate font-mono text-[12px] text-white/85">
                  {payload.walletLabel ?? shortenAddress(payload.walletAddress, 5)}
                </p>
              )}
            </div>
          </div>
          {overlay.showBranding ? (
            <div className="hidden text-right text-[10px] uppercase tracking-wider text-white/35 sm:block">
              {payload.timeframe} · {payload.chain.toUpperCase()}
            </div>
          ) : null}
        </div>

        {overlay.showCashbackFooter ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/55">
            <span className="inline-flex items-center gap-1">
              <span className="opacity-80">🌐</span> pointer.trade
            </span>
            <span className="text-white/35">·</span>
            <span className="font-medium text-white/70">50% cashback. Forever.</span>
            <span className="text-white/35">·</span>
            <span>Trade sharper on pointer.trade</span>
          </div>
        ) : null}
      </div>
    </div>
  );
});

PnlShareCard.displayName = 'PnlShareCard';
