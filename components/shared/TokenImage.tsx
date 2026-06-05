'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

function TokenImagePlaceholder({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <div
      className={cn('shrink-0 rounded-sm bg-bg-hover ring-1 ring-border-subtle', className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

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
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!src || broken) {
    return <TokenImagePlaceholder size={size} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn('shrink-0 rounded-sm object-cover ring-1 ring-border-subtle', className)}
    />
  );
}
