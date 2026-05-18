'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, Globe, Search, Send } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { PulseTokenAvatar } from '@/components/tokens/PulseTokenAvatar';
import { LaunchpadBadge } from '@/components/tokens/LaunchpadBadge';
import { LaunchpadSubBadges } from '@/components/tokens/LaunchpadSubBadges';
import { RiskFlags } from '@/components/tokens/RiskFlags';
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
import { shortenAddress } from '@/lib/utils/addresses';
import type { Tables } from '@/lib/supabase/types';
import type { TokenMarketSnapshotRow, TokenRow } from '@/lib/db/tokens';
import { cn } from '@/lib/utils/cn';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { explorerTokenAriaLabel, explorerTokenHrefFromMint } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';

const iconRow =
  'inline-flex h-3.5 w-3.5 shrink-0 cursor-pointer text-fg-muted transition-colors hover:text-fg-primary';

function pickPriceChange24hPct(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['priceChange24hPct', 'price_change_24h_pct', 'chg24hPct', 'change24hPct'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/%/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickAthMultiplier(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['athMultiple', 'ath_multiple', 'athX', 'ath_x'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/x$/i, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickAthUsd(ext: unknown): number | null {
  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const o = ext as Record<string, unknown>;
  for (const k of ['athUsd', 'ath_usd', 'ath_price_usd', 'allTimeHighUsd'] as const) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,]/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

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

  const bundle: PulseTokenBundle = { token, snapshot };
  const bonding = getPulseBondingRingState(bundle);
  const supplyRaw = extractSupplyTokens(token.raw_metadata);
  const supplyLabel = formatSupplyHint(supplyRaw);
  const feesSol = extractGlobalFeesSol(snapshot?.extended_metrics);
  const extJson = snapshot?.extended_metrics;

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

  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);

  const tw = token.twitter_handle?.replace(/^@/, '').trim();
  const xUrl = tw ? `https://x.com/${encodeURIComponent(tw)}` : null;

  const pulseSocial = useMemo(() => getPulseSocialModel({ token, snapshot }), [token, snapshot]);

  const priceChangePct = pickPriceChange24hPct(extJson);
  const athUsd = pickAthUsd(extJson);
  const athMult = pickAthMultiplier(extJson);
  const focalPrimary = useMemo(() => {
    if (snapshot?.market_cap_usd != null && Number.isFinite(snapshot.market_cap_usd)) {
      return formatCompactUsd(snapshot.market_cap_usd);
    }
    const px = formatPriceUsd(snapshot?.price_usd);
    return px !== '\u2014' ? px : '\u2014';
  }, [snapshot]);

  const bondingValue =
    bonding.fillPct != null ? formatPercent(bonding.fillPct, { decimals: 1 }) : '\u2014';

  const priceStr = formatPriceUsd(snapshot?.price_usd);
  const liquidityStr = formatCompactUsd(snapshot?.liquidity_usd);
  const supplyDisplay = supplyLabel ?? '\u2014';
  const feesDisplay =
    feesSol != null ? `${formatNumber(feesSol, { decimals: 3 })} ${nativeSym}` : '\u2014';
  const athPrimary = athUsd != null ? formatCompactUsd(athUsd) : '\u2014';

  const prosValue =
    proTraders != null ? String(proTraders) : extQ.isLoading ? '\u2026' : '\u2014';
  const prosMuted = prosValue === '\u2014' || prosValue === '\u2026' || prosValue === '0';

  const athSub =
    athMult != null && Number.isFinite(athMult) && athPrimary !== '\u2014'
      ? `${athMult.toFixed(1)}x`
      : undefined;

  const holdersValue =
    snapshot?.holder_count != null ? formatNumber(snapshot.holder_count, { decimals: 0 }) : '\u2014';

  const stats = [
    { label: 'Price', value: priceStr },
    { label: 'Liquidity', value: liquidityStr },
    { label: 'Supply', value: supplyDisplay },
    { label: 'Fees', value: feesDisplay },
    { label: 'Bonding', value: bondingValue, accent: true as const },
    {
      label: 'ATH',
      value: athPrimary,
      sub: athSub,
    },
    { label: 'Holders', value: holdersValue },
    { label: 'Pros', value: prosValue, prosMuted },
  ];

  const mintShort = shortenAddress(mint, 5);

  return (
    <div className="min-w-0 border-b border-border-subtle bg-bg-raised font-sans">
      <div className="scrollbar-thin flex h-16 min-w-0 items-center gap-3 overflow-x-auto px-4">
        {/* Left — identity */}
        <div className="flex shrink-0 items-center gap-2.5">
          <PulseTokenAvatar
            bundle={bundle}
            size={40}
            showRing={false}
            launchpadCorner={token.launch_pad === 'pump.fun'}
            className="shrink-0"
          />

          <div className="flex flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate text-base font-bold text-fg-primary">{ticker}</span>

              <span className="ml-1 shrink-0">
                <CopyButton
                  value={mint}
                  toastLabel="Mint copied"
                  label="Copy mint"
                  iconOnly
                  iconClassName="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                />
              </span>
              {token.website_url ? (
                <a
                  href={token.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0"
                  aria-label="Website"
                  title="Website"
                >
                  <Globe className={iconRow} strokeWidth={2} />
                </a>
              ) : null}
              {xUrl ? (
                <a href={xUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0" aria-label="Twitter / X">
                  <svg className={iconRow} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              ) : null}
              {pulseSocial.telegram ? (
                <a
                  href={pulseSocial.telegram}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0"
                  aria-label="Telegram"
                  title="Telegram"
                >
                  <Send className={iconRow} strokeWidth={2} />
                </a>
              ) : null}
              <button
                type="button"
                className={cn(iconRow, 'inline-flex shrink-0 rounded')}
                aria-label="Search"
                tabIndex={-1}
              >
                <Search className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={cn(iconRow, 'inline-flex shrink-0 rounded')}
                aria-label="Notifications"
                tabIndex={-1}
              >
                <Bell className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex min-w-0 max-w-[20rem] items-center gap-2 truncate text-[10px] leading-none">
              <span className="shrink-0 text-fg-secondary">{name}</span>
              <span className="shrink-0 font-mono tabular-nums text-fg-muted">{formatAgeShort(token.created_at)}</span>
              <span className="min-w-0 truncate font-mono text-fg-muted">{mintShort}</span>
            </div>
          </div>
        </div>

        {/* Middle — focal + stats */}
        <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-6 overflow-x-auto pl-4">
          <div className="flex shrink-0 flex-col">
            <span className="text-xl font-bold tabular-nums leading-none text-fg-primary">{focalPrimary}</span>
            {priceChangePct != null ? (
              <span
                className={cn(
                  'mt-0.5 text-[10px] font-medium tabular-nums leading-tight',
                  priceChangePct >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {priceChangePct >= 0 ? '+' : ''}
                {priceChangePct.toFixed(2)}%
              </span>
            ) : null}
          </div>

          {stats.map((stat) => {
            const mutedBase =
              stat.value === '\u2014' || stat.value === '\u2026' || stat.value === '';

            let valueClassName = mutedBase ? 'text-fg-muted' : 'text-fg-primary';
            if ('accent' in stat && stat.accent && stat.value !== '\u2014') {
              valueClassName = 'text-signal-warn';
            }
            if ('prosMuted' in stat && stat.prosMuted && stat.value !== '\u2014') {
              valueClassName = 'text-fg-muted';
            }

            return (
              <div key={stat.label} className="flex shrink-0 flex-col gap-0.5">
                <span className="text-[10px] uppercase leading-none tracking-wider text-fg-muted">
                  {stat.label}
                </span>
                <span className={`text-xs font-semibold tabular-nums leading-none ${valueClassName}`}>
                  {stat.value}
                </span>
                {'sub' in stat && stat.sub ? (
                  <span className="text-[10px] font-medium tabular-nums leading-none text-signal-bull">
                    {stat.sub}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Right */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {token.launch_pad && token.launch_pad !== 'pump.fun' ? (
            <LaunchpadBadge launchPad={token.launch_pad} />
          ) : null}
          <LaunchpadSubBadges token={token} snapshot={snapshot} variant="detail" />
          <RiskFlags token={token as Tables<'tokens'>} snapshot={snapshot} className="shrink-0" />
          <span className="hidden h-5 w-px shrink-0 bg-border-subtle sm:inline-block" aria-hidden />
          <a
            href={explorerTokenHrefFromMint(mint, activeChain)}
            target="_blank"
            rel="noreferrer"
            className={cn('focus-ring inline-flex shrink-0 rounded', iconRow)}
            aria-label={explorerTokenAriaLabel(activeChain)}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}
