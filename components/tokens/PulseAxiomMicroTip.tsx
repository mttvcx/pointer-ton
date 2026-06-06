'use client';

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

/** Tiny opaque label chip — Axiom “Holders” / “Snipers Holding” parity. */
export const pulseAxiomMicroTipClass = cn(
  'z-[300] max-w-none rounded px-2 py-[5px]',
  'border-0 bg-[#0a0a0a] text-[11px] font-normal leading-none text-white/85 shadow-none',
  'animate-in fade-in-0 duration-75 ease-out motion-reduce:animate-none',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75 data-[state=closed]:ease-in',
);

export function PulseAxiomMicroTip({
  label,
  children,
  side = 'top',
  sideOffset = 5,
  delayDuration = 100,
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  delayDuration?: number;
}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset} className={pulseAxiomMicroTipClass}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Strip protocol + trailing slash + www for the bold title line. */
function hostTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}

/**
 * Axiom-style link tooltip: bold host title + the full URL beneath. The URL
 * line truncates with an ellipsis once it exceeds the chip width (short URLs
 * fit in full, long ones cut with "…").
 */
export function PulseAxiomUrlTip({
  url,
  title,
  children,
  side = 'top',
  sideOffset = 5,
  delayDuration = 100,
}: {
  url: string;
  title?: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  delayDuration?: number;
}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-[300] w-max max-w-[260px] rounded px-2 py-1.5',
          'border-0 bg-[#0a0a0a] shadow-none',
          'animate-in fade-in-0 duration-75 ease-out motion-reduce:animate-none',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75 data-[state=closed]:ease-in',
        )}
      >
        <span className="block max-w-full truncate text-[11px] font-semibold leading-tight text-white/90">
          {title ?? hostTitleFromUrl(url)}
        </span>
        <span className="mt-0.5 block max-w-full truncate text-[10px] leading-tight text-white/55">
          {url}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
