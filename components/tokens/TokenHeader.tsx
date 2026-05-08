'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, Eye, Globe, Minimize2, Search, Settings, Star } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { TokenHeaderAvatar } from '@/components/tokens/TokenHeaderAvatar';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { RiskFlags } from '@/components/tokens/RiskFlags';
import { readChartOverlays, persistChartOverlays, type ChartOverlayFlags } from '@/lib/chart/tokenChartOverlays';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import { getPulseSocialModel } from '@/lib/tokens/pulseSocialLinks';
import {
  extractGlobalFeesSol,
  extractSupplyTokens,
  formatSupplyHint,
} from '@/lib/tokens/metadataHints';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  formatAgeShort,
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatPriceUsd,
} from '@/lib/utils/formatters';
import { explorerTokenUrl, shortenAddress } from '@/lib/utils/addresses';
import type { Tables } from '@/lib/supabase/types';
import type { TokenMarketSnapshotRow, TokenRow } from '@/lib/db/tokens';
import { cn } from '@/lib/utils/cn';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';

export function TokenHeader({
  token,
  snapshot,
  mint,
}: {
  token: TokenRow;
  snapshot: TokenMarketSnapshotRow | null;
  mint: string;
}) {
  const ticker = token.symbol ?? '???';
  const name = token.name ?? 'Unknown';
  const top10 = snapshot?.top10_holder_pct;

  const bundle: PulseTokenBundle = { token, snapshot };
  const bonding = getPulseBondingRingState(bundle);
  const supplyRaw = extractSupplyTokens(token.raw_metadata);
  const supplyLabel = formatSupplyHint(supplyRaw);
  const feesSol = extractGlobalFeesSol(snapshot?.extended_metrics);
  const marketCapLabel = formatCompactUsd(snapshot?.market_cap_usd);

  const extQ = useQuery({
    queryKey: ['token-header-metrics', mint],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}/extended-metrics`);
      const json: unknown = await res.json();
      if (!res.ok) return null;
      return json as { metrics: TokenExtendedMetrics };
    },
    staleTime: 45_000,
  });
  const proTraders = extQ.data?.metrics.proTraders ?? null;

  const [overlays, setOverlays] = useState<ChartOverlayFlags>(() => readChartOverlays());

  useEffect(() => {
    const sync = () => setOverlays(readChartOverlays());
    sync();
    window.addEventListener('pointer-chart-overlays', sync);
    return () => window.removeEventListener('pointer-chart-overlays', sync);
  }, []);

  const patchOverlays = useCallback((patch: Partial<ChartOverlayFlags>) => {
    setOverlays((prev) => {
      const next = { ...prev, ...patch };
      persistChartOverlays(next);
      return next;
    });
  }, []);

  const tw = token.twitter_handle?.replace(/^@/, '').trim();
  const xUrl = tw ? `https://x.com/${encodeURIComponent(tw)}` : null;
  const xSearchUrl = `https://x.com/search?q=${encodeURIComponent(mint)}&src=typed_query&f=live`;

  const pulseSocial = useMemo(() => getPulseSocialModel({ token, snapshot }), [token, snapshot]);

  return (
    <div
      className="border-b border-[#1b1f2a] bg-[#080d14] font-sans"
     
    >
      <div className="mx-auto flex h-[56px] max-w-[1800px] items-center gap-3 overflow-hidden px-2 sm:px-3">
        <div className="flex min-w-[220px] shrink-0 items-center gap-2">
          <TokenHeaderAvatar src={token.image_url} alt={ticker} mint={mint} size={36} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-[16px] font-semibold leading-tight text-[#f3f4f6]">{ticker}</h1>
              <span className="truncate text-[13px] text-[#9ca3af]">{name}</span>
              <CopyButton value={mint} toastLabel="Mint copied" label="Copy mint" className="shrink-0 text-[#6b7280]" />
              <Star className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" strokeWidth={2} />
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-none text-[#9ca3af]">
              <span className="font-semibold tabular-nums text-emerald-400">{formatAgeShort(token.created_at)}</span>
              <span className="truncate tabular-nums">{shortenAddress(mint, 5)}</span>
              {token.creator_wallet ? (
                <>
                  <span className="text-[#374151]">•</span>
                  <CopyButton
                    value={token.creator_wallet}
                    toastLabel="Creator copied"
                    label="Copy creator"
                    className="text-[#9ca3af]"
                  >
                    dev {shortenAddress(token.creator_wallet, 4)}
                  </CopyButton>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-1 text-[20px] font-semibold leading-none tabular-nums text-[#f3f4f6]">
          {marketCapLabel}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto [scrollbar-width:none]">
          <MetricChip label="Price" value={formatPriceUsd(snapshot?.price_usd)} />
          <MetricChip label="Liquidity" value={formatCompactUsd(snapshot?.liquidity_usd)} />
          <MetricChip label="Supply" value={supplyLabel ?? '—'} />
          <MetricChip
            label="Fees"
            value={feesSol != null ? `${formatNumber(feesSol, { decimals: 3 })} TON` : '—'}
          />
          <MetricChip
            label="B.Curve"
            value={
              bonding.fillPct != null ? formatPercent(bonding.fillPct, { decimals: 1 }) : '—'
            }
            valueClass={bonding.fillPct != null && bonding.fillPct >= 85 ? 'text-[#5eead4]' : undefined}
          />
          <MetricChip label="ATH" value="—" />
          <MetricChip
            label="Holders"
            value={
              snapshot?.holder_count != null
                ? formatNumber(snapshot.holder_count, { decimals: 0 })
                : '—'
            }
          />
          <MetricChip
            label="Pro"
            value={proTraders != null ? String(proTraders) : extQ.isLoading ? '…' : '—'}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {xUrl ? (
            <a href={xUrl} target="_blank" rel="noreferrer" className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#94a3b8]" aria-label="Twitter / X">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          ) : null}
          {pulseSocial.telegram ? (
            <a
              href={pulseSocial.telegram}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#94a3b8]"
              aria-label="Telegram"
              title="Telegram"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
            </a>
          ) : null}
          {token.website_url ? (
            <a href={token.website_url} target="_blank" rel="noreferrer" className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#94a3b8]" aria-label="Website">
              <Globe className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          ) : null}
          <button type="button" className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[12px] tabular-nums text-[#9ca3af] hover:bg-white/5" title="Holders (snapshot)">
            <Eye className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            {snapshot?.holder_count != null ? formatNumber(snapshot.holder_count, { decimals: 0 }) : '—'}
          </button>
          <a href={xSearchUrl} target="_blank" rel="noreferrer" className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#94a3b8]" aria-label="Search contract address on X" title="Search CA on X">
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <span className="mx-1 h-5 w-px bg-[#1b1f2a]" />
          <ToggleChip
            on={overlays.devTrades}
            onToggle={() => patchOverlays({ devTrades: !overlays.devTrades })}
            label="Dev"
          />
          <ToggleChip
            on={overlays.trackedOnly}
            onToggle={() => patchOverlays({ trackedOnly: !overlays.trackedOnly })}
            label="Trk"
          />
          <ToggleChip
            on={overlays.alertBubbles}
            onToggle={() => patchOverlays({ alertBubbles: !overlays.alertBubbles })}
            label="Bub"
          />
          <LaunchpadBadge launchPad={token.launch_pad} />
          <LaunchpadSubBadges token={token} snapshot={snapshot} variant="detail" />
          <RiskFlags token={token as Tables<'tokens'>} snapshot={snapshot} className="ml-0.5" />
          <Link href="/pulse" className="focus-ring rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb]" aria-label="Pulse">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <a href={explorerTokenUrl(mint)} target="_blank" rel="noreferrer" className="focus-ring rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-[#a78bfa]" aria-label="TON explorer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Settings className="h-3.5 w-3.5 text-[#6b7280]" strokeWidth={2} />
          <Bell className="h-3.5 w-3.5 text-[#6b7280]" strokeWidth={2} />
          <Minimize2 className="h-3.5 w-3.5 text-[#6b7280]" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <span
      className="inline-flex shrink-0 flex-col gap-0.5 leading-none"
      title={sub}
    >
      <span className="text-[11px] font-medium text-[#6b7280]">{label}</span>
      <span
        className={cn(
          'text-[14px] font-semibold tabular-nums text-[#f9fafb]',
          valueClass,
        )}
      >
        {value}
      </span>
    </span>
  );
}

function ToggleChip({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition',
        on
          ? 'border-[#38bdf8]/50 bg-[#38bdf8]/15 text-[#7dd3fc]'
          : 'border-[#1b1f2a] text-[#6b7280] hover:border-[#2d3548] hover:text-[#9ca3af]',
      )}
    >
      {label}
    </button>
  );
}
