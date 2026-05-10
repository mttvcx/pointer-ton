'use client';

import Link from 'next/link';
import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import { useWalletLabels, labelColorClass } from '@/lib/hooks/useWalletLabels';
import { cn } from '@/lib/utils/cn';
import { useWalletIntelStore } from '@/store/walletIntelStore';

function chainFromAddress(addr: string): AppChainId {
  const k = inferMintKind(addr);
  if (k === 'sol') return 'sol';
  if (k === 'ton') return 'ton';
  if (k === 'evm') return 'bnb';
  return 'sol';
}

/**
 * Renders a wallet with optional user label + emoji + color.
 * Right-click / long-press target: opens the label modal via store.
 */
export function WalletDisplay({
  address,
  href,
  className,
  truncate = 3,
  preferIntelModal,
}: {
  address: string;
  /** When set, wraps text in a Link (e.g. `/wallet/...`). */
  href?: string;
  className?: string;
  truncate?: number;
  /** Normal click opens wallet intelligence instead of navigating (modifier-click still navigates). */
  preferIntelModal?: boolean;
}) {
  const { resolveLabel, openLabelModal } = useWalletLabels();
  const openWallet = useWalletIntelStore((s) => s.openWallet);
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
        onClick={(e) => {
          e.stopPropagation();
          if (!preferIntelModal) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          openWallet({ address, chain: chainFromAddress(address) });
        }}
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
