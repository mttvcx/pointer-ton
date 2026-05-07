'use client';

import { cn } from '@/lib/utils/cn';

export function TokenImage({
  src,
  alt,
  size = 36,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn('shrink-0 rounded-sm bg-bg-hover ring-1 ring-border-subtle', className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className={cn('shrink-0 rounded-sm object-cover ring-1 ring-border-subtle', className)}
    />
  );
}
