'use client';

import { cn } from '@/lib/utils/cn';

/** Stylized Kalshi lockup — partnership preview branding. */
export function KalshiWordmark({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text =
    size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-[15px]' : 'text-[12px]';

  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="Kalshi">
      <svg className={cn('shrink-0', icon)} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5"
          fill="rgba(0,180,120,0.15)"
          stroke="rgba(52,211,153,0.45)"
          strokeWidth={1}
        />
        <path
          d="M7 16V8h2.4l2.1 4.8L13.6 8H16v8h-1.8v-5.2L11.8 16h-1.4L8.8 10.8V16H7Z"
          fill="rgba(167,243,208,0.95)"
        />
      </svg>
      <span className={cn('font-bold tracking-tight text-emerald-200', text)}>Kalshi</span>
    </span>
  );
}

export function KalshiPoweredBy({ className, subtle }: { className?: string; subtle?: boolean }) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-[11px]',
        subtle ? 'text-fg-muted/80' : 'text-fg-secondary',
        className,
      )}
    >
      <span className="text-fg-muted">Powered by</span>
      <KalshiWordmark size="sm" />
    </p>
  );
}
