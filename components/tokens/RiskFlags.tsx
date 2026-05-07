'use client';

import type { ReactNode } from 'react';
import { Flame, Key, Snowflake, Unlock, Users } from 'lucide-react';
import type { Tables } from '@/lib/supabase/types';
import { cn } from '@/lib/utils/cn';

type Token = Tables<'tokens'>;
type Snap = Tables<'token_market_snapshots'>;

interface Flag {
  key: string;
  icon: ReactNode;
  title: string;
  /** bear / warn so colors map to severity. */
  tone: 'bear' | 'warn';
}

export function RiskFlags({
  token,
  snapshot,
  className,
}: {
  token: Token;
  snapshot: Snap | null;
  className?: string;
}) {
  const flags: Flag[] = [];
  if (token.mint_authority) {
    flags.push({
      key: 'mint',
      icon: <Key className="h-3 w-3" strokeWidth={2.25} />,
      title: 'Mint authority is active - supply can be inflated.',
      tone: 'bear',
    });
  }
  if (token.freeze_authority) {
    flags.push({
      key: 'freeze',
      icon: <Snowflake className="h-3 w-3" strokeWidth={2.25} />,
      title: 'Freeze authority is active - balances can be frozen.',
      tone: 'bear',
    });
  }
  if (token.is_lp_locked === false) {
    flags.push({
      key: 'lp',
      icon: <Unlock className="h-3 w-3" strokeWidth={2.25} />,
      title: 'Liquidity pool is not locked.',
      tone: 'warn',
    });
  }
  const top10 = snapshot?.top10_holder_pct;
  if (top10 != null && top10 > 40) {
    flags.push({
      key: 'top10',
      icon: <Users className="h-3 w-3" strokeWidth={2.25} />,
      title: `Top-10 wallets hold ${top10.toFixed(0)}%.`,
      tone: 'warn',
    });
  }
  if (snapshot?.holder_count != null && snapshot.holder_count < 25) {
    flags.push({
      key: 'thin',
      icon: <Flame className="h-3 w-3" strokeWidth={2.25} />,
      title: `Only ${snapshot.holder_count} holders.`,
      tone: 'warn',
    });
  }

  if (flags.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {flags.map((f) => (
        <span
          key={f.key}
          title={f.title}
          aria-label={f.title}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-sm border border-border-subtle transition-colors duration-150',
            f.tone === 'bear' ? 'text-signal-bear' : 'text-signal-warn',
          )}
        >
          {f.icon}
        </span>
      ))}
    </div>
  );
}
