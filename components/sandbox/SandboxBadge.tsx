'use client';

import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSandboxEnabled } from '@/components/sandbox/SandboxProvider';
import { useSandboxLedger } from '@/lib/sandbox/ledger';

/**
 * Always-visible SANDBOX label. `variant="topbar"` shows the fake SOL balance;
 * `variant="bottombar"` is a compact pill. Renders nothing in live mode.
 */
export function SandboxBadge({ variant = 'topbar' }: { variant?: 'topbar' | 'bottombar' }) {
  const enabled = useSandboxEnabled();
  const solBalance = useSandboxLedger((s) => {
    const w = s.wallets.find((x) => x.id === s.activeWalletId) ?? s.wallets[0];
    return w?.solBalance ?? 0;
  });

  if (!enabled) return null;

  return (
    <Link
      href="/sandbox"
      title="Sandbox mode — fake balances, fake fills, no real funds or transactions. Click for sandbox panel."
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wide transition-colors',
        'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20',
        variant === 'topbar' ? 'h-8 px-2.5 text-[11px]' : 'h-6 px-2 text-[10px]',
      )}
    >
      <FlaskConical className={variant === 'topbar' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={2.2} aria-hidden />
      Sandbox
      {variant === 'topbar' ? (
        <span className="ml-1 font-mono tabular-nums text-amber-200">
          {solBalance.toFixed(2)} SOL
        </span>
      ) : null}
    </Link>
  );
}
