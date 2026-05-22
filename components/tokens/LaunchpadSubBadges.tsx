'use client';

import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import { cn } from '@/lib/utils/cn';
import type { Tables } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';

type SubVariant = 'inline' | 'detail';

export function LaunchpadSubBadges({
  token,
  snapshot,
  bundle,
  variant = 'inline',
  className,
}: {
  token?: Tables<'tokens'>;
  snapshot?: Tables<'token_market_snapshots'> | null;
  bundle?: PulseTokenBundle;
  variant?: SubVariant;
  className?: string;
}) {
  const t = bundle?.token ?? token;
  const s = bundle?.snapshot ?? snapshot ?? null;
  if (!t) return null;

  const { fillPct, migrated } = getPulseBondingRingState({ token: t, snapshot: s });

  type Item = { key: string; label: string; title: string; cls: string };
  const items: Item[] = [];

  if (!migrated && fillPct != null && fillPct > 0 && fillPct < 99.5) {
    items.push({
      key: 'bc',
      label: `${Math.round(fillPct)}%`,
      title: 'Bonding curve progress',
      cls: 'border-border-subtle text-fg-muted',
    });
  } else if (fillPct != null && fillPct >= 99.5 && !migrated) {
    items.push({
      key: 'bc-full',
      label: 'BC',
      title: 'Bonding curve nearly complete',
      cls: 'border-border-subtle text-fg-muted',
    });
  }

  if (t.is_lp_locked === true) {
    items.push({
      key: 'lp',
      label: 'LP',
      title: 'Liquidity locked',
      cls: 'border-emerald-400/30 text-emerald-300/90',
    });
  }

  if (t.is_paid === true) {
    items.push({
      key: 'pd',
      label: 'PD',
      title: 'Paid promotion',
      cls: 'border-sky-400/35 text-sky-200/85',
    });
  }

  if (items.length === 0) return null;

  const textSize = variant === 'detail' ? 'text-[9px]' : 'text-[8px]';

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-0.5', className)}
      aria-label={items.map((i) => i.title).join(', ')}
    >
      {items.map((it) => (
        <span
          key={it.key}
          title={it.title}
          className={cn(
            'rounded border px-1 py-px tabular-nums font-semibold uppercase leading-none tracking-wide',
            textSize,
            it.cls,
          )}
        >
          {it.label}
        </span>
      ))}
    </span>
  );
}
