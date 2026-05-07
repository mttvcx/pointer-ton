'use client';

import type { SVGProps } from 'react';

const sx = 'shrink-0 block';

/** X mark (readable at small sizes) */
export function GlyphX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

/** Telegram plane */
export function GlyphTelegram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path
        fill="currentColor"
        d="m14.5 2.2-13 5c-.3.1-.4.4-.2.6l3 2.8 1.1 3.8c.1.4.7.4.9.1l1.7-2.1 3.5 2.5c.2.2.6.1.7-.2l2.5-10.4c.1-.4-.3-.7-.6-.5Zm-8.2 7.7.4 2.8-.9-3.1 5.8-5.4-6.9 4.2-3.2-1.5 10.4-3.7-5.6 6.7Z"
      />
    </svg>
  );
}

export function GlyphGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M2 8h12M8 2c1.8 2.1 1.8 11.9 0 12M8 2C6.2 4.1 6.2 11.9 8 14"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Single profile silhouette (Axiom-style creator link) */
export function GlyphProfile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path
        d="M8 7.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM4.2 13.6c.3-2.3 1.8-4 3.8-4s3.5 1.7 3.8 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Two people / community */
export function GlyphCommunity(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path
        d="M5.4 6.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM3 12.8c.2-1.8 1.2-3 2.6-3 1 0 1.8.7 2.2 1.7M10.8 7a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM8.2 12.8c.3-1.7 1.3-3 2.6-3 .7 0 1.3.4 1.8 1"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Linked post: chain hint */
export function GlyphPostLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path
        d="M6.5 9.5 4 12a2.2 2.2 0 0 1-3.1-3.1l2.1-2.1M9.5 6.5 12 4a2.2 2.2 0 0 0-3.1-3.1L6.8 3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M8.5 11h3V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Pump.fun curve glyph (matches badge language) */
export function GlyphPump(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={sx} aria-hidden width={14} height={14} {...props}>
      <path
        d="M8 2.5v2.2M8 4.7c-2.2 0-3.8 1.5-3.8 3.4 0 1.1.6 2.1 1.5 2.6M8 4.7c2.2 0 3.8 1.5 3.8 3.4 0 1.1-.6 2.1-1.5 2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10.8" r="1.15" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
