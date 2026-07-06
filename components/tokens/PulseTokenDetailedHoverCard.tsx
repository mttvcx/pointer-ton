'use client';

import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Globe, Search, Send } from 'lucide-react';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { useTokenExtendedMetrics } from '@/lib/hooks/useTokenExtendedMetrics';
import { formatAgeShort, formatCompactUsd } from '@/lib/utils/formatters';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { TokenChart } from '@/components/tokens/TokenChart';
import { cn } from '@/lib/utils/cn';
import type { PulseTokenBundle } from '@/types/tokens';

/** Width the parent hover positioner reserves for the detailed card. */
export const DETAILED_HOVER_WIDTH = 624;

const BUY_AMOUNTS = [1, 2, 5, 10] as const;
const SELL_PCTS = [10, 25, 50, 100] as const;
/** How many metric cells show per page (arrows page through the rest — Axiom-style). */
const METRICS_PER_PAGE = 5;

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

/** Compact metric cell for the scrollable strip. Red when a risk metric is high. */
function MetricCell({ label, value, raw, warnAbove }: { label: string; value: string; raw?: number | null; warnAbove?: number }) {
  const warn = warnAbove != null && raw != null && Number.isFinite(raw) && raw >= warnAbove;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 leading-tight">
      <span className="text-[8.5px] uppercase tracking-wide text-fg-muted">{label}</span>
      <span className={cn('text-[12px] font-semibold tabular-nums', warn ? 'text-signal-bear' : 'text-fg-primary')}>{value}</span>
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
      className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg-primary"
    >
      {children}
    </a>
  );
}

/**
 * Axiom-style rich token preview shown on image hover ("Detailed token hover"
 * display setting): a real embedded chart + buy/sell + a scrollable metrics strip.
 * Data is fetched on-open and bounded — see the on-demand-bounded-fetch principle.
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
  const { buyToken, sellTokenPct, canTrade } = usePulseQuickBuy();
  const [page, setPage] = useState(0);

  const label = token.symbol?.trim() || token.name?.trim() || token.mint.slice(0, 6);
  const twitterHref = token.twitter_handle
    ? token.twitter_handle.startsWith('http')
      ? token.twitter_handle
      : `https://x.com/${token.twitter_handle.replace(/^@/, '')}`
    : null;

  const vol = metrics.vol6hUsd ?? null;
  const holders = metrics.holders ?? snapshot?.holder_count ?? null;
  const devPct = metrics.devHoldingPct ?? snapshot?.dev_holding_pct ?? null;

  // Paged metric cells — a few clear ones at a time, arrows step through the rest.
  const metricDefs: { label: string; value: string; raw?: number | null; warnAbove?: number }[] = [
    { label: 'Top 10', value: pct(metrics.top10HolderPct), raw: metrics.top10HolderPct, warnAbove: 35 },
    { label: 'Holders', value: holders != null ? String(holders) : '—' },
    { label: 'Fees', value: pct(metrics.taxPct), raw: metrics.taxPct, warnAbove: 5 },
    { label: 'Bundlers', value: pct(metrics.bundlersPct), raw: metrics.bundlersPct, warnAbove: 10 },
    { label: 'Snipers', value: pct(metrics.sniperHolderPct), raw: metrics.sniperHolderPct, warnAbove: 10 },
    { label: 'Insiders', value: pct(metrics.insidersPct), raw: metrics.insidersPct, warnAbove: 15 },
    { label: 'Pro', value: metrics.proTraders != null ? String(metrics.proTraders) : '—' },
    { label: 'LP burn', value: pct(metrics.lpBurnedPct) },
  ];
  const pageCount = Math.max(1, Math.ceil(metricDefs.length / METRICS_PER_PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageMetrics = metricDefs.slice(clampedPage * METRICS_PER_PAGE, clampedPage * METRICS_PER_PAGE + METRICS_PER_PAGE);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/20 bg-bg-raised shadow-[0_24px_70px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]"
      style={{ width: DETAILED_HOVER_WIDTH }}
      data-no-launch
    >
      {/* Header: name + socials + inline market stats */}
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2">
        <button
          type="button"
          data-row-click-skip="true"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(token.mint);
          }}
          className="min-w-0 text-left"
        >
          <p className="truncate text-[13px] font-semibold text-fg-primary hover:text-accent-primary">{label}</p>
          <p className="truncate text-[10px] text-fg-muted">
            {token.name?.trim() && token.name !== label ? `${token.name} · ` : ''}
            {formatAgeShort(token.created_at, nowMs)}
          </p>
        </button>
        <div className="ml-auto grid grid-cols-4 gap-3">
          <Stat label="MC" value={formatCompactUsd(snapshot?.market_cap_usd ?? null)} />
          <Stat label="Liq" value={formatCompactUsd(snapshot?.liquidity_usd ?? null)} />
          <Stat label="Vol" value={formatCompactUsd(vol)} />
          <Stat label="Dev" value={pct(devPct)} valueCls={(devPct ?? 0) >= 5 ? 'text-signal-bear' : undefined} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {twitterHref ? (
            <SocialIcon href={twitterHref} title="X / Twitter">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </SocialIcon>
          ) : null}
          {token.telegram_url ? <SocialIcon href={token.telegram_url} title="Telegram"><Send className="h-3 w-3" strokeWidth={2} /></SocialIcon> : null}
          {token.website_url ? <SocialIcon href={token.website_url} title="Website"><Globe className="h-3 w-3" strokeWidth={2} /></SocialIcon> : null}
          <SocialIcon href={`https://solscan.io/token/${token.mint}`} title="Solscan"><Search className="h-3 w-3" strokeWidth={2} /></SocialIcon>
        </div>
      </div>

      {/* Paged metrics strip — a few clear cells at a time; arrows step through pages. */}
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-1.5 py-1.5">
        <button
          type="button"
          data-row-click-skip="true"
          disabled={clampedPage === 0}
          onClick={(e) => { e.stopPropagation(); setPage((p) => Math.max(0, p - 1)); }}
          className="shrink-0 rounded p-0.5 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary disabled:pointer-events-none disabled:opacity-25"
          aria-label="Previous metrics"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
        <div className="flex min-w-0 flex-1 items-stretch gap-1">
          {pageMetrics.map((m) => (
            <MetricCell key={m.label} label={m.label} value={m.value} raw={m.raw} warnAbove={m.warnAbove} />
          ))}
        </div>
        <button
          type="button"
          data-row-click-skip="true"
          disabled={clampedPage >= pageCount - 1}
          onClick={(e) => { e.stopPropagation(); setPage((p) => Math.min(pageCount - 1, p + 1)); }}
          className="shrink-0 rounded p-0.5 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary disabled:pointer-events-none disabled:opacity-25"
          aria-label="More metrics"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {/* Body: image + buy/sell (left) · chart (right) */}
      <div className="flex">
        <div className="flex w-[176px] shrink-0 flex-col gap-2 border-r border-border-subtle p-2">
          <div className="group/img relative aspect-square w-full overflow-hidden rounded-lg bg-bg-sunken ring-1 ring-border-subtle transition hover:ring-accent-primary/40">
            <button
              type="button"
              data-row-click-skip="true"
              title="Open token"
              onClick={(e) => { e.stopPropagation(); onNavigate(token.mint); }}
              className="block h-full w-full"
            >
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover/img:scale-[1.75]"
                  draggable={false}
                />
              ) : null}
            </button>
            {imageUrl ? (
              /* Reverse image search — spot recycled / stolen token art (Axiom-style). */
              <button
                type="button"
                data-row-click-skip="true"
                title="Reverse image search (Google Lens)"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white opacity-0 backdrop-blur-sm transition group-hover/img:opacity-100 hover:bg-black/80"
              >
                <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>

          <div>
            <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-wider text-fg-muted">Buy · SOL</p>
            <div className="grid grid-cols-2 gap-1">
              {BUY_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={!canTrade}
                  data-row-click-skip="true"
                  onClick={(e) => { e.stopPropagation(); void buyToken(token.mint, amt); }}
                  className="flex items-center justify-center rounded-md border border-signal-bull/30 bg-signal-bull/10 py-1.5 text-[11px] font-bold text-signal-bull transition hover:border-signal-bull/50 hover:bg-signal-bull/20 disabled:pointer-events-none disabled:opacity-40"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-wider text-fg-muted">Sell · %</p>
            <div className="grid grid-cols-2 gap-1">
              {SELL_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!canTrade}
                  data-row-click-skip="true"
                  onClick={(e) => { e.stopPropagation(); void sellTokenPct(token.mint, p); }}
                  className="rounded-md border border-signal-bear/30 bg-signal-bear/10 py-1.5 text-[11px] font-bold text-signal-bear transition hover:border-signal-bear/50 hover:bg-signal-bear/20 disabled:pointer-events-none disabled:opacity-40"
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Real chart — adjustable (intervals, indicators, drawing tools). */}
        <div
          className="relative h-[300px] min-w-0 flex-1"
          data-row-click-skip="true"
          data-no-drag
          onClick={(e) => e.stopPropagation()}
        >
          <TokenChart mint={token.mint} symbol={token.symbol} edgeToEdge />
        </div>
      </div>
    </div>
  );
}
