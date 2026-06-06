'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TokenNameHoverMenu } from '@/components/tokens/TokenNameHoverMenu';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { cn } from '@/lib/utils/cn';

/** Axiom-style ticker + name with hover copy menu (mint, name, Google, X, in-app search). */
export function PulseTokenTitleRow({
  mint,
  ticker,
  name,
  size = 'pulse',
}: {
  mint: string;
  ticker: string;
  name: string;
  size?: 'pulse' | 'compact';
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => clearTimer(), []);

  const showMenu = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), 80);
  };

  const hideMenu = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  async function copyMint(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(mint);
      toastCopied(mint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      toastCopyFailed();
    }
  }

  const tickerCls = size === 'pulse' ? 'text-[16px]' : 'text-[15px]';
  const nameCls = size === 'pulse' ? 'text-[15px]' : 'text-[14px]';

  return (
    <div
      className="group/mintTitle relative z-[6] flex min-w-0 max-w-full flex-col overflow-visible"
      data-popover-open={open ? 'true' : undefined}
    >
      <div
        className={cn(
          'inline-flex w-fit max-w-full min-w-0 items-center gap-1 overflow-hidden rounded-sm px-0.5 -mx-0.5 transition-colors duration-150',
          open ? 'bg-white/[0.06]' : 'hover:bg-white/[0.05]',
        )}
        data-row-click-skip="true"
        onMouseEnter={showMenu}
        onMouseLeave={hideMenu}
      >
        <p className="min-w-0 truncate font-sans leading-[1.12] whitespace-nowrap">
          <span
            className={cn(
              'font-semibold tracking-tight transition-colors duration-150',
              tickerCls,
              open ? 'text-[#5ebbff]' : 'text-fg-primary',
            )}
          >
            {ticker}
          </span>
          <span
            className={cn(
              'ml-1.5 font-normal tracking-tight transition-colors duration-150',
              nameCls,
              open ? 'text-[#5ebbff]/90' : 'text-fg-secondary',
            )}
          >
            {name}
          </span>
        </p>
        <button
          type="button"
          onClick={(e) => void copyMint(e)}
          className={cn(
            'focus-ring shrink-0 rounded-sm p-0.5 transition-opacity',
            open || copied
              ? 'text-[#5ebbff] opacity-100'
              : 'text-fg-muted opacity-0 group-hover/mintTitle:opacity-100',
            copied && 'text-signal-bull',
          )}
          data-row-click-skip="true"
          aria-label="Copy contract address"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <TokenNameHoverMenu
        ticker={ticker}
        name={name}
        mint={mint}
        open={open}
        onMouseEnter={showMenu}
        onMouseLeave={hideMenu}
      />
    </div>
  );
}
