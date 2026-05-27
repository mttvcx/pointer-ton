'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { useUIStore } from '@/store/ui';

function mintCopyLabel(mint: string): string {
  const m = mint.trim();
  if (m.length >= 4 && m.toLowerCase().endsWith('pump')) {
    return `...${m.slice(-4)}`;
  }
  return shortenAddress(m, 4);
}

function truncateLabel(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function copyText(value: string, preview?: string) {
  try {
    await navigator.clipboard.writeText(value);
    toastCopied(value, { preview });
  } catch {
    toastCopyFailed();
  }
}

function MenuRow({
  icon,
  label,
  detail,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">{icon}</span>
      <span className="min-w-0 truncate text-[12px] text-fg-secondary">
        {label}
        {detail ? (
          <>
            {' '}
            <span className="text-fg-muted">[{detail}]</span>
          </>
        ) : null}
      </span>
    </>
  );

  const className =
    'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.06]';

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

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
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);

  const searchLabel = name.trim() || ticker.trim();
  const mintShort = mintCopyLabel(mint);
  const nameShort = truncateLabel(searchLabel);

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

  const openAppSearch = () => {
    setSearchQuery(searchLabel);
    setSearchOpen(true);
    setOpen(false);
  };

  return (
    <span className="relative z-20 inline-flex min-w-0 max-w-full">
      <span
        className={cn(
          'min-w-0 max-w-full cursor-default truncate rounded px-0.5 -mx-0.5 transition-colors duration-150',
          open ? 'text-[#5ebbff]' : 'text-fg-primary hover:text-[#5ebbff]',
        )}
        onMouseEnter={show}
        onMouseLeave={hide}
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

      {open ? (
        <div
          role="menu"
          className="pointer-events-auto absolute left-0 top-[calc(100%+6px)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border-subtle/80 bg-bg-raised py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <MenuRow
            icon={<Copy className="h-3.5 w-3.5" strokeWidth={2} />}
            label="Copy"
            detail={mintShort}
            onClick={() => void copyText(mint, 'Mint copied')}
          />
          <MenuRow
            icon={<Copy className="h-3.5 w-3.5" strokeWidth={2} />}
            label="Copy"
            detail={nameShort}
            onClick={() => void copyText(searchLabel, 'Name copied')}
          />
          <MenuRow
            icon={
              <span className="text-[11px] font-bold leading-none">
                <span className="text-[#4285F4]">G</span>
              </span>
            }
            label="Google for"
            detail={nameShort}
            href={`https://www.google.com/search?q=${encodeURIComponent(searchLabel)}`}
          />
          <MenuRow
            icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            }
            label="X Search for"
            detail={nameShort}
            href={`https://x.com/search?q=${encodeURIComponent(searchLabel)}`}
          />
          <MenuRow
            icon={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
            label="Search for"
            detail={nameShort}
            onClick={openAppSearch}
          />
        </div>
      ) : null}
    </span>
  );
}
