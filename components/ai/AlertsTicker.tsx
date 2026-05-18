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

const AT = {
  card: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.1)',
  elevated: 'rgba(255, 255, 255, 0.07)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
  accent: '#0077b6',
} as const;

export function AlertsTicker() {
  const query = useAlertsTickerQuery();

  return (
    <div
      className="rounded-2xl border px-3 py-2.5 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
      style={{ borderColor: AT.border, backgroundColor: AT.card }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: AT.text }}>
          <Bell className="h-3.5 w-3.5" style={{ color: AT.accent }} />
          Activity
        </span>
        {query.data ? (
          <span
            className="rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums"
            style={{ borderColor: `${AT.accent}44`, color: AT.accent }}
          >
            {query.data.length}
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <ul className="space-y-1">
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="h-10 animate-pulse rounded-lg border"
              style={{ borderColor: AT.border, backgroundColor: AT.elevated }}
            />
          ))}
        </ul>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-[10px] leading-snug" style={{ color: AT.muted }}>
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
      className="group rounded-lg border px-2 py-1.5 text-[11px] leading-snug transition hover:bg-white/[0.03]"
      style={{ borderColor: AT.border, backgroundColor: AT.elevated }}
      {...hoverProps}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold capitalize" style={{ color: AT.accent }}>
        <span>{activityHeading(alert)}</span>
        <span className="ml-auto tabular-nums font-normal" style={{ color: AT.muted }}>
          {formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-3" style={{ color: AT.text }}>
        {alert.narration ?? rawSummary(alert.payload)}
      </p>
      {target ? (
        <Link
          href={target.href}
          className="mt-1 inline-block tabular-nums text-[10px] transition hover:underline"
          style={{ color: AT.muted }}
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
