'use client';

import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';

/** Monochrome stroke-only glyphs (~Axiom-style): muted, no brand fills. */
function IconPump({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
      width={14}
      height={14}
    >
      <path
        d="M8 2.5v2.2M8 4.7c-2.2 0-3.8 1.5-3.8 3.4 0 1.1.6 2.1 1.5 2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.7c2.2 0 3.8 1.5 3.8 3.4 0 1.1-.6 2.1-1.5 2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10.8" r="1.15" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconBags({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden width={14} height={14}>
      <path
        d="M4.2 6.8h7.6v6.1a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V6.8z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 6.5V5.2c0-1.1.9-2 2-2s2 .9 2 2v1.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoonshot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden width={14} height={14}>
      <path
        d="M9.3 3.2A4.1 4.1 0 0 0 4.4 8.1 4.1 4.1 0 0 0 9 12.1a4.1 4.1 0 0 0 4-2.8 3.6 3.6 0 0 1-4.3-1.4 3.6 3.6 0 0 1 .6-4.7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPrintr({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden width={14} height={14}>
      <rect x="4" y="3" width="8" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 9h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.2 11h5.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.2 12.5h5.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const GLYPH: Record<string, ComponentType<{ className?: string }>> = {
  'pump.fun': IconPump,
  bags: IconBags,
  moonshot: IconMoonshot,
  printr: IconPrintr,
};

const ABBREV: Record<string, string> = {
  'pump.fun': 'PU',
  bags: 'BG',
  moonshot: 'MS',
  printr: 'PR',
};

export function LaunchpadBadge({ launchPad }: { launchPad: string | null }) {
  if (!launchPad) return null;

  let fallback = launchPad.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  if (fallback.length === 1) fallback = `${fallback}${fallback}`;
  if (fallback.length === 0) fallback = 'LP';
  const abbrev = (ABBREV[launchPad] ?? fallback).slice(0, 2);

  const G = GLYPH[launchPad];
  if (G) {
    return (
      <span className="inline-flex shrink-0 text-fg-muted opacity-50" title={launchPad}>
        <G className="block h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-3.5 min-w-0 shrink-0 items-center tabular-nums text-[10px] font-semibold uppercase leading-none tracking-wide text-fg-muted opacity-50',
      )}
      title={launchPad}
    >
      {abbrev}
    </span>
  );
}
