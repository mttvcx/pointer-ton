'use client';

import { useEffect, useRef, useState } from 'react';

export type PriceFlashDir = 'up' | 'down' | null;

/** Flash green/red when a numeric price ticks. */
export function usePriceFlash(value: number, epsilon = 0.01): PriceFlashDir {
  const prev = useRef(value);
  const [flash, setFlash] = useState<PriceFlashDir>(null);

  useEffect(() => {
    const delta = value - prev.current;
    if (Math.abs(delta) >= epsilon) {
      setFlash(delta > 0 ? 'up' : 'down');
      prev.current = value;
      const t = window.setTimeout(() => setFlash(null), 720);
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value, epsilon]);

  return flash;
}

export function priceFlashClass(flash: PriceFlashDir): string {
  if (flash === 'up') return 'pred-price-flash-up';
  if (flash === 'down') return 'pred-price-flash-down';
  return '';
}
