'use client';

import Link from 'next/link';
import { useWalletLabels, labelColorClass } from '@/lib/hooks/useWalletLabels';
import { cn } from '@/lib/utils/cn';

/**
 * Renders a wallet with optional user label + emoji + color.
 * Right-click / long-press target: opens the label modal via store.
 */
export function WalletDisplay({
  address,
  href,
  className,
  truncate = 3,
}: {
  address: string;
  /** When set, wraps text in a Link (e.g. `/wallet/...`). */
  href?: string;
  className?: string;
  truncate?: number;
}) {
  const { resolveLabel, openLabelModal } = useWalletLabels();
  const r = resolveLabel(address, truncate);
  if (!r) return null;

  const textCls = cn(
    'min-w-0 truncate tabular-nums tabular-nums',
    r.labeled ? labelColorClass(r.color) : 'text-fg-secondary',
  );

  const inner = <span className={textCls}>{r.text}</span>;

  const linked =
    href != null ? (
      <Link
        href={href}
        className="min-w-0 truncate underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </Link>
    ) : (
      inner
    );

  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center', className)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openLabelModal(address);
      }}
    >
      {linked}
    </span>
  );
}
