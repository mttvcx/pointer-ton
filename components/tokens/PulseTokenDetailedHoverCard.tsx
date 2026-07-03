'use client';

import { Globe, Search, Send } from 'lucide-react';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { useTokenExtendedMetrics } from '@/lib/hooks/useTokenExtendedMetrics';
import { formatAgeShort, formatCompactUsd } from '@/lib/utils/formatters';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { cn } from '@/lib/utils/cn';
import type { PulseTokenBundle } from '@/types/tokens';

const BUY_AMOUNTS = [0.5, 1, 2, 5] as const;

function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v < 1 && v > 0 ? v.toFixed(1) : Math.round(v)}%`;
}

function Stat({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className={cn('truncate text-[12px] font-semibold tabular-nums text-fg-primary', valueCls)}>{value}</p>
    </div>
  );
}

/** Risk-tinted metric chip — red when a "bad-if-high" metric crosses `warnAbove`. */
function MetricChip({
  label,
  value,
  raw,
  warnAbove,
}: {
  label: string;
  value: string;
  raw?: number | null;
  warnAbove?: number;
}) {
  const warn = warnAbove != null && raw != null && Number.isFinite(raw) && raw >= warnAbove;
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-border-subtle bg-bg-sunken px-1.5 py-1">
      <span className="text-[9px] uppercase tracking-wide text-fg-muted">{label}</span>
      <span className={cn('text-[11px] font-semibold tabular-nums', warn ? 'text-signal-bear' : 'text-fg-secondary')}>
        {value}
      </span>
    </div>
  );
}

function SocialIcon({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      data-row-click-skip="true"
      onClick={(e) => e.stopPropagation()}
      className="flex h-5 w-5 items-center justify-center rounded-sm border border-border-subtle bg-bg-sunken text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary"
    >
      {children}
    </a>
  );
}

/**
 * Axiom-style rich token preview shown on image hover when the "Detailed token
 * hover" display setting is on. All data is fetched on-open (extended metrics
 * mounts with this card) and bounded — see the on-demand-bounded-fetch principle.
 */
export function PulseTokenDetailedHoverCard({
  bundle,
  imageUrl,
  onNavigate,
}: {
  bundle: PulseTokenBundle;
  imageUrl: string | null;
  onNavigate: (mint: string) => void;
}) {
  const { token, snapshot } = bundle;
  const nowMs = useLiveClock();
  const { metrics } = useTokenExtendedMetrics(token.mint);
  const { buyToken, canTrade } = usePulseQuickBuy();

  const label = token.symbol?.trim() || token.name?.trim() || token.mint.slice(0, 6);
  const twitterHref = token.twitter_handle
    ? token.twitter_handle.startsWith('http')
      ? token.twitter_handle
      : `https://x.com/${token.twitter_handle.replace(/^@/, '')}`
    : null;

  const vol = metrics.vol6hUsd ?? null;
  const holders = metrics.holders ?? snapshot?.holder_count ?? null;
  const devPct = metrics.devHoldingPct ?? snapshot?.dev_holding_pct ?? null;

  return (
    <div className="w-[320px] overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2.5">
        <button
          type="button"
          data-row-click-skip="true"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(token.mint);
          }}
          className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-bg-sunken ring-1 ring-border-subtle transition hover:ring-accent-primary/40"
        >
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-fg-primary">{label}</p>
          <p className="truncate text-[10px] text-fg-muted">
            {token.name?.trim() && token.name !== label ? `${token.name} · ` : ''}
            {formatAgeShort(token.created_at, nowMs)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {twitterHref ? (
            <SocialIcon href={twitterHref} title="X / Twitter">
              <span className="text-[11px] font-bold leading-none">𝕏</span>
            </SocialIcon>
          ) : null}
          {token.telegram_url ? (
            <SocialIcon href={token.telegram_url} title="Telegram">
              <Send className="h-3 w-3" strokeWidth={2} />
            </SocialIcon>
          ) : null}
          {token.website_url ? (
            <SocialIcon href={token.website_url} title="Website">
              <Globe className="h-3 w-3" strokeWidth={2} />
            </SocialIcon>
          ) : null}
          <SocialIcon href={`https://solscan.io/token/${token.mint}`} title="Solscan">
            <Search className="h-3 w-3" strokeWidth={2} />
          </SocialIcon>
        </div>
      </div>

      {/* Market stats */}
      <div className="grid grid-cols-4 gap-2 px-3 py-2">
        <Stat label="MC" value={formatCompactUsd(snapshot?.market_cap_usd ?? null)} />
        <Stat label="Liq" value={formatCompactUsd(snapshot?.liquidity_usd ?? null)} />
        <Stat label="Vol" value={formatCompactUsd(vol)} />
        <Stat label="Dev" value={pct(devPct)} valueCls={(devPct ?? 0) >= 5 ? 'text-signal-bear' : undefined} />
      </div>

      {/* Risk metrics strip */}
      <div className="grid grid-cols-3 gap-1 px-3 pb-2">
        <MetricChip label="Top 10" value={pct(metrics.top10HolderPct)} raw={metrics.top10HolderPct} warnAbove={35} />
        <MetricChip label="Holders" value={holders != null ? String(holders) : '—'} />
        <MetricChip label="Snipers" value={pct(metrics.sniperHolderPct)} raw={metrics.sniperHolderPct} warnAbove={10} />
        <MetricChip label="Bundlers" value={pct(metrics.bundlersPct)} raw={metrics.bundlersPct} warnAbove={10} />
        <MetricChip label="Insiders" value={pct(metrics.insidersPct)} raw={metrics.insidersPct} warnAbove={15} />
        <MetricChip label="Fees" value={pct(metrics.taxPct)} raw={metrics.taxPct} warnAbove={5} />
      </div>

      {/* Quick buy */}
      <div className="flex items-center gap-1 border-t border-border-subtle bg-bg-raised px-3 py-2">
        {BUY_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            disabled={!canTrade}
            data-row-click-skip="true"
            onClick={(e) => {
              e.stopPropagation();
              void buyToken(token.mint, amt);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-sm border border-accent-primary/30 bg-accent-primary/10 py-1.5 text-[11px] font-semibold text-accent-primary transition',
              'hover:bg-accent-primary/20 hover:border-accent-primary/50 disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <span className="text-[9px] opacity-70">⚡</span>
            {amt}
          </button>
        ))}
      </div>
    </div>
  );
}
