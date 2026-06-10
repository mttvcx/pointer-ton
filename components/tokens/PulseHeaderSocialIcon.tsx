'use client';

import { cn } from '@/lib/utils/cn';

export type PulseHeaderSocialIconKind = 'profile' | 'globe' | 'telegram' | 'search';

/**
 * Token detail header social glyphs.
 * Profile uses `pulse-glyphs/header-profile.png` (transparent blue outline PNG).
 */
export function PulseHeaderSocialIcon({
  kind,
  size = 28,
  className,
}: {
  kind: PulseHeaderSocialIconKind;
  size?: number;
  className?: string;
}) {
  const s = size;

  if (kind === 'profile') {
    return (
      // Token header only — transparent PNG, no shared Pulse `natural` blend path.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/pulse-glyphs/header-profile.png"
        alt=""
        width={s}
        height={s}
        draggable={false}
        aria-hidden
        className={cn('pointer-events-none shrink-0 border-0 bg-transparent object-contain ring-0', className)}
        style={{ width: s, height: s }}
      />
    );
  }

  if (kind === 'globe') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        className={cn('shrink-0 text-fg-secondary', className)}
        aria-hidden
      >
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.65" />
        <ellipse cx="12" cy="12" rx="3.35" ry="8.25" stroke="currentColor" strokeWidth="1.65" />
        <path d="M3.75 12h16.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
        <path
          d="M5.2 16.1h13.6M5.2 7.9h13.6"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === 'telegram') {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        className={cn('shrink-0', className)}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9.25" fill="#2AABEE" />
        <path
          d="M7.2 11.8 16.4 8.1c.5-.2.9-.1 1 .4.1.3 0 .6-.2.8l-2.7 1.3 1 3.1c.1.4-.1.6-.5.4l-1.4-1.1-1.7 1.6c-.2.2-.4.2-.5 0l-.2-2.4-3.1-1.9c-.4-.2-.4-.5.1-.7Z"
          fill="white"
        />
      </svg>
    );
  }

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0 text-fg-secondary', className)}
      aria-hidden
    >
      <circle cx="10.75" cy="10.75" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m15.8 15.8 4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
