'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DESK_FIELD_TOOLTIPS } from '@/lib/tokens/deskFieldTooltips';

const COOLDOWN_MS = 50_000;

function formatCooldown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${s}s`;
}

export function TokenSupplyRefreshControl({
  mint,
  lastRefreshedAt,
  className,
}: {
  mint: string;
  lastRefreshedAt?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooldownLeft = Math.max(0, cooldownUntil - now);
  const disabled = loading || cooldownLeft > 0;

  const onRefresh = useCallback(async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}/refresh-desk`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('refresh_failed');
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['token-extended-metrics', mint] }),
        queryClient.invalidateQueries({ queryKey: ['token-holders', mint] }),
        queryClient.invalidateQueries({ queryKey: ['mint-trades', mint] }),
      ]);
      router.refresh();
    } catch {
      /* silent — user can retry after cooldown */
    } finally {
      setLoading(false);
    }
  }, [disabled, mint, queryClient, router]);

  const tooltip = disabled && cooldownLeft > 0
    ? `Refetch supply and LP info. Next refetch available in ${formatCooldown(cooldownLeft)}.`
    : loading
      ? 'Refreshing supply and LP info…'
      : `${DESK_FIELD_TOOLTIPS.supply} ${DESK_FIELD_TOOLTIPS.liquidity}`;

  const lastLabel =
    lastRefreshedAt && !Number.isNaN(new Date(lastRefreshedAt).getTime())
      ? new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={disabled}
          aria-label="Refetch supply and LP info"
          className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            'text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg-primary',
            'disabled:cursor-not-allowed disabled:opacity-40',
            className,
          )}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
          ) : (
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] text-[10px] leading-snug">
        <p>{tooltip}</p>
        {lastLabel ? <p className="mt-1 text-fg-muted">Last refreshed {lastLabel}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}
