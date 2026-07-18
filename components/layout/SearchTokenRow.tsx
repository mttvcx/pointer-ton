'use client';

import { formatDistanceToNowStrict, subMilliseconds } from 'date-fns';
import { Copy, Globe, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { TokenImage } from '@/components/shared/TokenImage';
import { Popover } from '@/components/ui/popover';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { spendAssetLabel } from '@/lib/trading/spendAsset';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { searchModalRowHoverClass } from '@/lib/ui/searchModalChrome';
import type { SearchQuickBuyChrome, SearchQuickBuySize } from '@/store/searchModalPrefs';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';

export type SearchRowModel = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
  /** Live metrics only — `null` renders as `—`. */
  mcUsd: number | null;
  volUsd: number | null;
  liqUsd: number | null;
  ageMs: number | null;
  dexLabel: string;
};

function formatBuyAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 100) return String(Math.round(n));
  if (Number.isInteger(n)) return String(n);
  return formatNumber(n, { decimals: 2 });
}

function searchQuickBuyClasses(chrome: SearchQuickBuyChrome, size: SearchQuickBuySize): string {
  const dim =
    size === 'ultra'
      ? // Ultra = the whole row's right edge is one outlined buy zone (Axiom-style),
        // not a little pill. Stretches to the full row height.
        'self-stretch min-h-full min-w-[7rem] rounded-lg px-3.5 text-[12.5px]'
      : size === 'small'
        ? 'h-9 min-w-[5rem] rounded-md px-2.5 text-[10px]'
        : size === 'large' || size === 'mega'
          ? 'h-11 min-w-[7.25rem] rounded-md px-3.5 text-xs'
          : 'h-10 min-w-[6.25rem] rounded-md px-3 text-[11px]';

  const base = cn(
    'focus-ring relative flex shrink-0 flex-row items-center justify-center gap-1.5 border font-semibold tabular-nums transition-colors',
    'disabled:pointer-events-none disabled:opacity-55',
    dim,
  );

  if (chrome === 'accent') {
    return cn(base, 'border-border-subtle bg-bg-hover text-fg-primary hover:border-border-default hover:bg-bg-sunken');
  }
  if (chrome === 'filled') {
    return cn(
      base,
      'border-emerald-400/90 bg-emerald-400 text-[#030806] hover:border-emerald-300 hover:bg-emerald-300',
    );
  }
  return cn(
    base,
    'border-emerald-400/55 bg-transparent text-emerald-400 hover:border-emerald-400/80 hover:bg-emerald-400/10',
  );
}

function SearchStatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-[4.25rem] shrink-0 text-right lg:w-[4.75rem]">
      <div className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="text-sm font-semibold leading-tight tabular-nums text-fg-primary">{value}</div>
    </div>
  );
}

export function SearchTokenRow({
  row,
  compact,
  rowPadding,
  quickBuySize,
  quickBuyChrome,
  quickBuyAmount,
  onCloseSearch,
  showBadgeDot,
}: {
  row: SearchRowModel;
  compact: boolean;
  rowPadding: string;
  quickBuySize: SearchQuickBuySize;
  quickBuyChrome: SearchQuickBuyChrome;
  quickBuyAmount: number;
  onCloseSearch: () => void;
  showBadgeDot?: boolean;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const { buyToken, canTrade } = usePulseQuickBuy();
  const [copyOpen, setCopyOpen] = useState(false);

  const sym = row.symbol?.trim() ?? '';
  const name = row.name?.trim() ?? '';
  const symbolTitle = sym || shortenAddress(row.mint, 4);
  const nameMuted =
    name && name.toLowerCase() !== symbolTitle.toLowerCase() ? name : shortenAddress(row.mint, 5);
  const ageLabel =
    row.ageMs != null
      ? formatDistanceToNowStrict(subMilliseconds(new Date(), row.ageMs), { addSuffix: false })
      : null;
  const spend: 'sol' | 'usdc' = spendAsset === 'usdc' ? 'usdc' : 'sol';
  const quote = activeChain === 'sol' ? spendAssetLabel(spend) : spendAssetLabel('sol');
  const buyLabel = formatBuyAmount(quickBuyAmount);
  // Smaller + rounded reads crisper (Axiom-style) than the old boxy 44-48px.
  const avatarSize = compact ? 38 : 42;
  const isUltra = quickBuySize === 'ultra';
  // Cursor spotlight (matches the Pulse ultra outline) — glow span is self-clipped.
  const onGlowMove = (e: ReactMouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--qb-mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--qb-my', `${e.clientY - r.top}px`);
  };
  const mc = row.mcUsd != null ? formatCompactUsd(row.mcUsd) : '—';
  const vol = row.volUsd != null ? formatCompactUsd(row.volUsd) : '—';
  const liq = row.liqUsd != null ? formatCompactUsd(row.liqUsd) : '—';

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
      setCopyOpen(false);
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <li className={cn('group flex w-full items-center gap-3 sm:gap-4', rowPadding)}>
      <Link
        href={`/token/${encodeURIComponent(row.mint)}`}
        onClick={onCloseSearch}
        className={cn(
          'focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md sm:gap-4',
          searchModalRowHoverClass,
        )}
      >
        <div className="relative shrink-0">
          <TokenImage
            src={row.image_url}
            alt={symbolTitle}
            size={avatarSize}
            className="rounded-lg ring-border-subtle/70"
          />
          {showBadgeDot ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg-raised bg-signal-warn"
              title="Launch status"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 basis-0">
          <div className="group/mintTitle flex min-w-0 max-w-full flex-col overflow-hidden">
            <div
              className={cn(
                'inline-flex w-fit max-w-full items-center gap-1 overflow-hidden rounded-sm px-0.5 -mx-0.5',
                'transition-colors hover:bg-bg-hover',
              )}
            >
              <span className="truncate text-[15px] font-semibold text-fg-primary sm:text-base">
                {symbolTitle}
              </span>
              <Popover.Root open={copyOpen} onOpenChange={setCopyOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={cn(
                      'focus-ring shrink-0 rounded-sm p-0.5 text-fg-muted opacity-0 transition group-hover/mintTitle:opacity-100',
                      copyOpen && 'opacity-100 text-fg-secondary',
                    )}
                    aria-label="Copy options"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </Popover.Trigger>
                <Popover.Content
                  align="start"
                  className="z-[700] w-52 rounded-lg border border-border-subtle bg-bg-raised p-1 text-xs shadow-2xl backdrop-blur-md"
                >
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-fg-secondary hover:bg-bg-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyText(row.mint, 'Contract');
                    }}
                  >
                    Copy {shortenAddress(row.mint, 4)}
                  </button>
                  {sym ? (
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-fg-secondary hover:bg-bg-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyText(sym, 'Ticker');
                      }}
                    >
                      Copy {sym}
                    </button>
                  ) : null}
                </Popover.Content>
              </Popover.Root>
            </div>
            <span className="truncate text-[11px] text-fg-muted sm:text-xs">{nameMuted}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
            {ageLabel ? <span className="font-medium text-fg-secondary">{ageLabel}</span> : null}
            <span className="text-fg-muted">{row.dexLabel}</span>
            <span className="flex items-center gap-1 text-fg-muted">
              <Globe className="h-3 w-3 shrink-0" aria-hidden />
              <Shield className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-4 sm:flex lg:gap-5">
          <SearchStatCell label="MC" value={mc} />
          {!isUltra ? (
            <>
              <SearchStatCell label="V" value={vol} />
              <SearchStatCell label="L" value={liq} />
            </>
          ) : null}
        </div>
      </Link>

      {activeChain === 'sol' && isUltra ? (
        // Ultra = ONE outlined block (Axiom/Pulse-style): V + L + buy, full row
        // height, accent border + backdrop-blur on hover + cursor spotlight.
        // Reuses the exact `pulse-qb-ultra` CSS so border/no-border/blur match Pulse.
        <button
          type="button"
          disabled={!canTrade}
          onMouseMove={onGlowMove}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void buyToken(row.mint, quickBuyAmount, { spendAsset: spendAsset === 'usdc' ? 'usdc' : 'sol' });
          }}
          className={cn(
            'pulse-qb-ultra group/qb focus-ring relative flex shrink-0 self-stretch items-center gap-3 rounded-lg border px-3 font-semibold transition-colors sm:gap-4 sm:px-4',
            quickBuyChrome === 'filled' ? 'pulse-qb-ultra--filled' : 'pulse-qb-ultra--outline',
            'disabled:pointer-events-none disabled:opacity-55',
          )}
          title={canTrade ? `Quick buy ${buyLabel} ${quote}` : 'Connect wallet to quick buy'}
          aria-label={`Quick buy ${buyLabel} ${quote}`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-lg opacity-0 transition-opacity duration-150 group-hover/qb:opacity-100"
            style={{
              background:
                'radial-gradient(70px circle at var(--qb-mx, 50%) var(--qb-my, 50%), rgb(var(--pulse-accent-rgb) / 0.22), transparent 72%)',
            }}
          />
          <div className="relative z-[1] hidden shrink-0 items-center gap-3 sm:flex sm:gap-4">
            <SearchStatCell label="V" value={vol} />
            <SearchStatCell label="L" value={liq} />
          </div>
          <span className="relative z-[1] flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12.5px] tabular-nums">
            <Zap
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                quickBuyChrome === 'filled' ? 'fill-[#030806] text-[#030806]' : 'fill-current',
              )}
              aria-hidden
            />
            {`${buyLabel} ${quote}`}
          </span>
        </button>
      ) : activeChain === 'sol' ? (
        <button
          type="button"
          disabled={!canTrade}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void buyToken(row.mint, quickBuyAmount, {
              spendAsset: spendAsset === 'usdc' ? 'usdc' : 'sol',
            });
          }}
          className={searchQuickBuyClasses(quickBuyChrome, quickBuySize)}
          title={canTrade ? `Quick buy ${buyLabel} ${quote}` : 'Connect wallet to quick buy'}
          aria-label={`Quick buy ${buyLabel} ${quote}`}
        >
          <Zap
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              quickBuyChrome === 'filled'
                ? 'fill-[#030806] text-[#030806]'
                : quickBuyChrome === 'accent'
                  ? 'fill-current'
                  : 'fill-emerald-400/35 text-emerald-400',
            )}
            aria-hidden
          />
          <span className="min-w-0 truncate leading-none">Buy</span>
        </button>
      ) : (
        <Link
          href={`/token/${encodeURIComponent(row.mint)}`}
          onClick={onCloseSearch}
          className="focus-ring flex h-10 min-w-[5.5rem] shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-hover px-3 text-[11px] font-semibold text-fg-secondary transition-colors hover:bg-bg-sunken hover:text-fg-primary sm:h-11 sm:min-w-[6.25rem]"
        >
          View
        </Link>
      )}
    </li>
  );
}
