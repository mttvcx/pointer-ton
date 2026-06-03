'use client';

import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { cn } from '@/lib/utils/cn';

type PtcsLockupProps = {
  className?: string;
  /** sm = compact header, lg = hero, watermark = faded bg */
  variant?: 'sm' | 'lg' | 'watermark';
};

export function PtcsLockup({ className, variant = 'sm' }: PtcsLockupProps) {
  if (variant === 'watermark') {
    return (
      <div
        className={cn('pointer-events-none flex select-none items-center gap-3 opacity-[0.045]', className)}
        aria-hidden
      >
        <PointerBirdMark size={88} className="opacity-90" />
        <span className="text-[5rem] font-black uppercase leading-none tracking-tighter text-fg-primary sm:text-[6.5rem]">
          PTCS
        </span>
      </div>
    );
  }

  const birdSize = variant === 'lg' ? 40 : 28;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-md border border-accent-primary/30 bg-accent-primary/10 shadow-[0_0_24px_-8px_rgb(var(--accent-primary-rgb)/0.6)]',
          variant === 'lg' ? 'h-11 w-11' : 'h-9 w-9',
        )}
      >
        <PointerBirdMark size={birdSize - 8} />
      </div>
      <div className="min-w-0 leading-none">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-accent-primary">PTCS</p>
        <p
          className={cn(
            'font-bold uppercase tracking-tight text-fg-primary',
            variant === 'lg' ? 'text-sm' : 'text-[11px]',
          )}
        >
          Championship
        </p>
      </div>
    </div>
  );
}
