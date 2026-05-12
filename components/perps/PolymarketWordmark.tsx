'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Stylized text lockup — not an official Polymarket asset; reads clearly at small sizes.
 */
export function PolymarketWordmark({
  className,
  size = 'md',
}: {
  className?: string;
  /** sm: compact strip header; md: sidebar / hero */
  size?: 'sm' | 'md';
}) {
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      aria-label="Polymarket"
    >
      <svg
        className={cn('shrink-0', icon)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="11" fill="rgba(75,130,249,0.18)" stroke="rgba(129,173,255,0.35)" strokeWidth={1} />
        <path
          d="M16.8 17.25H13.45c-3.62 0-5.93-2.27-5.93-6.02 0-3.71 2.31-6.06 6.06-6.06h3.21v12.08Zm-6.94-6.06c0 2 1 3.06 3.06 3.06h2.35V10.94h-2.35c-2 0-3.06.98-3.06 3.24Z"
          fill="rgba(226,237,255,0.95)"
        />
      </svg>
      <span className={cn('font-semibold tracking-tight text-[#d6e7ff]', text)}>
        Polymarket
      </span>
    </span>
  );
}

export function PolymarketPoweredBy({
  className,
  subtle,
}: {
  className?: string;
  subtle?: boolean;
}) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-[11px]',
        subtle ? 'text-fg-muted/80' : 'text-fg-secondary',
        className,
      )}
    >
      <span className="text-fg-muted">Powered by</span>
      <PolymarketWordmark size="sm" />
    </p>
  );
}
