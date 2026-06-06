'use client';

import { useEffect, useRef, useState } from 'react';
import { TokenNameHoverMenu } from '@/components/tokens/TokenNameHoverMenu';
import { cn } from '@/lib/utils/cn';

export function TokenHeaderNameHover({
  ticker,
  name,
  mint,
}: {
  ticker: string;
  name: string;
  mint: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => clearTimer(), []);

  const show = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), 100);
  };

  const hide = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <span className="relative z-20 inline-flex shrink-0">
      <span
        className={cn(
          'cursor-default whitespace-nowrap rounded px-0.5 -mx-0.5 transition-colors duration-150',
          open ? 'text-[#5ebbff]' : 'text-fg-primary hover:text-[#5ebbff]',
        )}
        onMouseEnter={show}
        onMouseLeave={hide}
        title={`${ticker} ${name}`}
      >
        <span className="text-[15px] font-bold tracking-tight">{ticker}</span>
        <span
          className={cn(
            'ml-1.5 text-[13px] font-normal transition-colors duration-150',
            open ? 'text-[#5ebbff]/90' : 'text-fg-secondary group-hover:text-[#5ebbff]/90',
          )}
        >
          {name}
        </span>
      </span>

      <TokenNameHoverMenu
        ticker={ticker}
        name={name}
        mint={mint}
        open={open}
        onMouseEnter={show}
        onMouseLeave={hide}
      />
    </span>
  );
}
