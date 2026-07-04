'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Globe, Search, Send } from 'lucide-react';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { useTokenExtendedMetrics } from '@/lib/hooks/useTokenExtendedMetrics';
import { formatAgeShort, formatCompactUsd } from '@/lib/utils/formatters';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { TokenChart } from '@/components/tokens/TokenChart';
import { cn } from '@/lib/utils/cn';
import type { PulseTokenBundle } from '@/types/tokens';

/** Width the parent hover positioner reserves for the detailed card. */
export const DETAILED_HOVER_WIDTH = 540;

const BUY_AMOUNTS = [1, 2, 5, 10] as const;
const SELL_PCTS = [10, 25, 50, 100] as const;

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
    <div className="flex shrink-0 flex-col items-center justify-center rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-1 leading-tight">
      <span className="text-[8.5px] uppercase tracking-wide text-fg-muted">{label}</span>
      <span className={cn('text-[11px] font-semibold tabular-nums', warn ? 'text-signal-bear' : 'text-fg-primary')}>{value}</span>
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
  const stripRef = useRef<HTMLDivElement>(null);

  const label = token.symbol?.trim() || token.name?.trim() || token.mint.slice(0, 6);
  const twitterHref = token.twitter_handle
    ? token.twitter_handle.startsWith('http')
      ? token.twitter_handle
      : `https://x.com/${token.twitter_handle.replace(/^@/, '')}`
    : null;

  const vol = metrics.vol6hUsd ?? null;
  const holders = metrics.holders ?? snapshot?.holder_count ?? null;
  const devPct = metrics.devHoldingPct ?? snapshot?.dev_holding_pct ?? null;

  const scrollStrip = (dir: -1 | 1) => stripRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });

  return (
    <div
      className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)]"
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
            <SocialIcon href={twitterHref} title="X / Twitter"><span className="text-[11px] font-bold leading-none">𝕏</span></SocialIcon>
          ) : null}
          {token.telegram_url ? <SocialIcon href={token.telegram_url} title="Telegram"><Send className="h-3 w-3" strokeWidth={2} /></SocialIcon> : null}
          {token.website_url ? <SocialIcon href={token.website_url} title="Website"><Globe className="h-3 w-3" strokeWidth={2} /></SocialIcon> : null}
          <SocialIcon href={`https://solscan.io/token/${token.mint}`} title="Solscan"><Search className="h-3 w-3" strokeWidth={2} /></SocialIcon>
        </div>
      </div>

      {/* Scrollable metrics strip with arrows */}
      <div className="flex items-center gap-1 border-b border-border-subtle px-1.5 py-1.5">
        <button type="button" data-row-click-skip="true" onClick={(e) => { e.stopPropagation(); scrollStrip(-1); }} className="shrink-0 rounded p-0.5 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary" aria-label="Scroll metrics left">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
        <div ref={stripRef} className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MetricCell label="Top 10" value={pct(metrics.top10HolderPct)} raw={metrics.top10HolderPct} warnAbove={35} />
          <MetricCell label="Holders" value={holders != null ? String(holders) : '—'} />
          <MetricCell label="Fees" value={pct(metrics.taxPct)} raw={metrics.taxPct} warnAbove={5} />
          <MetricCell label="Bundlers" value={pct(metrics.bundlersPct)} raw={metrics.bundlersPct} warnAbove={10} />
          <MetricCell label="Snipers" value={pct(metrics.sniperHolderPct)} raw={metrics.sniperHolderPct} warnAbove={10} />
          <MetricCell label="Insiders" value={pct(metrics.insidersPct)} raw={metrics.insidersPct} warnAbove={15} />
          <MetricCell label="Pro" value={metrics.proTraders != null ? String(metrics.proTraders) : '—'} />
          <MetricCell label="LP burn" value={pct(metrics.lpBurnedPct)} />
        </div>
        <button type="button" data-row-click-skip="true" onClick={(e) => { e.stopPropagation(); scrollStrip(1); }} className="shrink-0 rounded p-0.5 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary" aria-label="Scroll metrics right">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {/* Body: image + buy/sell (left) · chart (right) */}
      <div className="flex">
        <div className="flex w-[140px] shrink-0 flex-col gap-2 border-r border-border-subtle p-2">
          <button
            type="button"
            data-row-click-skip="true"
            onClick={(e) => { e.stopPropagation(); onNavigate(token.mint); }}
            className="aspect-square w-full overflow-hidden rounded-lg bg-bg-sunken ring-1 ring-border-subtle transition hover:ring-accent-primary/40"
          >
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : null}
          </button>

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
          className="relative h-[260px] min-w-0 flex-1"
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
