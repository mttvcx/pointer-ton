'use client';

import { cn } from '@/lib/utils/cn';

export function IdentityAvatar({
  src,
  name,
  size = 24,
  className,
  ringClassName,
}: {
  src: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
  /** Chart bubble border color */
  ringClassName?: string;
}) {
  const initials = (name?.trim()?.[0] ?? '?').toUpperCase();
  const px = size;
  if (src?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        draggable={false}
        className={cn(
          'shrink-0 rounded-full object-cover bg-bg-sunken',
          ringClassName,
          className,
        )}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold uppercase text-white/70',
        ringClassName,
        className,
      )}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
