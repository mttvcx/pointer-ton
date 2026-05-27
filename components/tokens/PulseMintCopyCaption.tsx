'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { CopyToastChip } from '@/components/ui/CopyToastChip';
import { shortenAddress } from '@/lib/utils/addresses';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { signalMintCopied } from '@/lib/clipboard/mintClipboardSignal';
import { useToastAnchorRight } from '@/lib/ui/toastLayout';
import { cn } from '@/lib/utils/cn';

/** Axiom-style CA under avatar — `EwgW…pump` when mint ends with pump. */
export function pulseMintCaptionLabel(mint: string): string {
  const m = mint.trim();
  if (m.length >= 8 && m.toLowerCase().endsWith('pump')) {
    return `${m.slice(0, 4)}…pump`;
  }
  return shortenAddress(m, 4);
}

export function PulseMintCopyCaption({
  mint,
  compact = false,
}: {
  mint: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const anchorRight = useToastAnchorRight();

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setTipPos(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const syncTipPos = () => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    setTipPos({
      top: r.top + r.height / 2,
      left: r.right + 8,
    });
  };

  const show = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      if (!anchorRight) syncTipPos();
      setOpen(true);
    }, 60);
  };

  const hide = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      setOpen(false);
      setTipPos(null);
    }, 100);
  };

  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(mint);
      signalMintCopied(mint);
      toastCopied(mint);
      setOpen(false);
      setTipPos(null);
    } catch {
      toastCopyFailed();
    }
  }

  const label = pulseMintCaptionLabel(mint);

  const tooltip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <CopyToastChip
            mint={mint}
            onClick={copy}
            onMouseEnter={show}
            onMouseLeave={hide}
            className={cn(
              'fixed z-[250]',
              anchorRight
                ? 'right-[14px] top-[calc(var(--app-topbar-h)+12px)]'
                : '-translate-y-1/2',
            )}
            style={
              anchorRight
                ? undefined
                : tipPos
                  ? { top: tipPos.top, left: tipPos.left }
                  : undefined
            }
          />,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={copy}
        onMouseEnter={show}
        onMouseLeave={hide}
        data-row-click-skip="true"
        data-popover-open={open ? 'true' : undefined}
        className={cn(
          'mx-auto block max-w-full truncate rounded border px-1.5 py-0.5 font-sans font-normal tabular-nums tracking-tight transition-[color,background-color,border-color] duration-150',
          compact ? 'text-[10px] leading-snug' : 'text-[11px] leading-normal',
          open
            ? 'border-[rgb(var(--signal-bull-rgb)/0.35)] bg-bg-base text-signal-bull'
            : 'border-transparent bg-transparent text-fg-muted/80 hover:border-[rgb(var(--signal-bull-rgb)/0.28)] hover:bg-bg-base hover:text-signal-bull',
        )}
        aria-label={`Copy ${mint}`}
      >
        {label}
      </button>
      {tooltip}
    </>
  );
}
