'use client';

import { Copy, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { shortenAddress } from '@/lib/utils/addresses';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

export function mintCopyLabel(mint: string): string {
  const m = mint.trim();
  if (m.length >= 4 && m.toLowerCase().endsWith('pump')) {
    return `...${m.slice(-4)}`;
  }
  return shortenAddress(m, 4);
}

export function truncateNameLabel(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function copyHoverMenuText(value: string, preview?: string) {
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-row-click-skip="true"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      data-row-click-skip="true"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={className}
    >
      {inner}
    </button>
  );
}

/** Axiom-style name hover menu — copy mint/name, Google, X, in-app search. */
export function TokenNameHoverMenu({
  ticker,
  name,
  mint,
  open,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  ticker: string;
  name: string;
  mint: string;
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
}) {
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);

  const searchLabel = name.trim() || ticker.trim();
  const mintShort = mintCopyLabel(mint);
  const nameShort = truncateNameLabel(searchLabel);

  const openAppSearch = () => {
    setSearchQuery(searchLabel);
    setSearchOpen(true);
  };

  if (!open) return null;

  return (
    <div
      role="menu"
      data-row-click-skip="true"
      className={cn(
        'pointer-events-auto absolute left-0 top-[calc(100%+6px)] z-[120] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border-subtle/80 bg-bg-raised py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]',
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuRow
        icon={<Copy className="h-3.5 w-3.5" strokeWidth={2} />}
        label="Copy"
        detail={mintShort}
        onClick={() => void copyHoverMenuText(mint, 'Mint copied')}
      />
      <MenuRow
        icon={<Copy className="h-3.5 w-3.5" strokeWidth={2} />}
        label="Copy"
        detail={nameShort}
        onClick={() => void copyHoverMenuText(searchLabel, 'Name copied')}
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
  );
}
