'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Bell } from 'lucide-react';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import type { EntityRef } from '@/store/ui';
import type { AlertsTickerItem } from '@/lib/hooks/useAlertsTicker';
import {
  ALERT_TYPE_ALERT_RULE,
  ALERT_TYPE_TWITTER_LISTEN,
} from '@/lib/alerts/alertRuleModel';
import { ALERT_TYPE_USER_TRADE, type UserTradeAlertPayload } from '@/lib/alerts/userActivityAlerts';

export function AlertsTicker() {
  const query = useAlertsTickerQuery();

  return (
    <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-primary">
          <Bell className="h-3 w-3 text-fg-muted" strokeWidth={2.25} />
          Activity
        </span>
        {query.data ? (
          <span className="rounded-sm border border-white/[0.08] bg-bg-base px-1.5 py-px text-[10px] font-semibold tabular-nums text-fg-muted">
            {query.data.length}
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <ul className="space-y-1">
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="h-9 animate-pulse rounded-sm border border-white/[0.06] bg-bg-base"
            />
          ))}
        </ul>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-[10px] leading-snug text-fg-muted">
          No events yet — your trades, keyword alerts, and Pulse rules will show up here.
        </p>
      ) : (
        <ul className="space-y-1">
          {query.data.map((a) => (
            <AlertItem key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertItem({ alert }: { alert: AlertsTickerItem }) {
  const target = useMemo(() => pickTarget(alert.payload), [alert.payload]);
  const hoverProps = useEntityHover(target?.entity ?? null);

  return (
    <li
      className="group rounded-sm border border-white/[0.06] bg-bg-base px-2 py-1.5 text-[11px] leading-snug transition hover:bg-white/[0.03]"
      {...hoverProps}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold capitalize text-fg-secondary">
        <span>{activityHeading(alert)}</span>
        <span className="ml-auto tabular-nums font-normal text-fg-muted">
          {formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-fg-primary">
        {alert.narration ?? rawSummary(alert.payload)}
      </p>
      {target ? (
        <Link
          href={target.href}
          className="mt-1 inline-block tabular-nums text-[10px] text-fg-muted transition hover:text-fg-primary hover:underline"
        >
          {target.label}
        </Link>
      ) : null}
    </li>
  );
}

function activityHeading(alert: AlertsTickerItem): string {
  if (alert.type === ALERT_TYPE_USER_TRADE) {
    const p = alert.payload as UserTradeAlertPayload | undefined;
    switch (p?.kind) {
      case 'pulse_quick_buy':
        return 'Pulse buy';
      case 'pulse_quick_sell':
        return 'Pulse sell';
      case 'token_panel_buy':
        return 'Token buy';
      case 'token_panel_sell':
        return 'Token sell';
      case 'spot_buy':
        return 'Buy';
      case 'spot_sell_pct':
      case 'spot_sell_sol_out':
        return 'Sell';
      default:
        return 'Trade';
    }
  }
  if (alert.type === ALERT_TYPE_TWITTER_LISTEN) return 'X listen';
  if (alert.type === ALERT_TYPE_ALERT_RULE) return 'Pulse rule';
  if (alert.type === 'limit_alert_triggered') return 'Limit alert';
  if (alert.type === 'pulse_new_token') return 'New token';
  return alert.type.replace(/[_-]/g, ' ');
}

function rawSummary(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return JSON.stringify(payload ?? null);
  const obj = payload as Record<string, unknown>;
  const candidates = ['message', 'summary', 'reason', 'symbol', 'mint', 'wallet'];
  for (const key of candidates) {
    if (typeof obj[key] === 'string') return String(obj[key]);
  }
  return JSON.stringify(obj).slice(0, 200);
}

function pickTarget(
  payload: unknown,
): { href: string; label: string; entity: EntityRef } | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const mint = typeof obj.mint === 'string' ? obj.mint : null;
  const wallet = typeof obj.wallet === 'string' ? obj.wallet : null;
  const symbol = typeof obj.symbol === 'string' ? obj.symbol : undefined;
  if (mint && isValidPublicKey(mint)) {
    return {
      href: `/token/${mint}`,
      label: `token ${shortenAddress(mint, 4)}`,
      entity: { type: 'token', id: mint, label: symbol },
    };
  }
  if (wallet && isValidPublicKey(wallet)) {
    return {
      href: `/wallet/${wallet}`,
      label: `wallet ${shortenAddress(wallet, 4)}`,
      entity: { type: 'wallet', id: wallet },
    };
  }
  return null;
}
