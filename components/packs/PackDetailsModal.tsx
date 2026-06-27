'use client';

import { X } from 'lucide-react';
import type { PackPublicConfig } from '@/types/pack';
import { listPackShowcaseItems } from '@/lib/packs/packShowcase';
import { formatApproxUsd, formatPackMc, formatPackVal } from '@/lib/packs/formatDisplay';
import { PACK_VISUAL, RARITY_THEME } from '@/lib/packs/rarityTheme';
import { PackSolAmount } from '@/components/packs/PackSolAmount';
import { cn } from '@/lib/utils/cn';

type PackDetailsModalProps = {
  config: PackPublicConfig;
  onClose: () => void;
};

export function PackDetailsModal({ config, onClose }: PackDetailsModalProps) {
  const vis = PACK_VISUAL[config.type];
  const isDev = process.env.NODE_ENV === 'development';
  const hits = listPackShowcaseItems(config.type, config.solUsd);

  return (
    <div
      className="fixed inset-0 z-[550] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-details-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"
        aria-label="Close pack details"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(88vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-sm border border-white/10 bg-[#06080d] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn('border-b border-white/[0.06] px-5 py-4', vis.gradient, 'bg-gradient-to-r')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', vis.accent)}>
                {config.label} pack
              </p>
              <h2 id="pack-details-title" className="mt-1 text-xl font-semibold tracking-tight">
                What you can get
              </h2>
              <p className="mt-1 text-[13px] text-fg-secondary">
                Top hits only — sorted from most insane downward. Odds per slot.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-press focus-ring rounded-sm p-2 text-fg-muted hover:bg-white/[0.06] hover:text-fg-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-fg-muted">
            <span>Price</span>
            <PackSolAmount amount={config.packPriceSol} size="md" />
            <span className="text-border-strong">·</span>
            <span>{config.cardsPerOpen} cards per rip</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mb-4 rounded-sm border border-white/[0.06] bg-black/25 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Per-card odds</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {config.odds.map((row) => (
                <div
                  key={row.rarity}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="capitalize text-fg-secondary">{row.rarity}</span>
                  <span className="font-mono tabular-nums text-fg-muted">{row.probabilityPct}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {hits.map((hit, index) => {
              const theme = RARITY_THEME[hit.rarity];
              const isToken = hit.kind === 'token_reward' || hit.kind === 'legendary_reward';
              return (
                <article
                  key={hit.id}
                  className={cn(
                    'flex gap-4 rounded-sm border bg-black/30 p-3',
                    theme.ring.replace('ring-', 'border-'),
                    index === 0 && hit.rarity === 'mythic' && 'border-amber-300/40 bg-amber-950/20',
                  )}
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-white/10 bg-black/40">
                    {isToken && hit.tokenIconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={hit.tokenIconUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className={cn('flex h-full w-full items-center justify-center text-[10px] font-bold uppercase', theme.text)}>
                        {hit.kind === 'rare_access_badge' ? 'Pass' : 'Boost'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-[10px] font-bold uppercase tracking-[0.16em]', theme.text)}>
                        {theme.label}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-fg-muted">{hit.probabilityPct}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-fg-primary">
                      {hit.tokenSymbol ?? hit.title}
                    </p>
                    <p className="text-[12px] text-fg-muted">{hit.subtitle}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      {isToken ? (
                        hit.valueUsd != null ? (
                          <span className="font-mono tabular-nums text-accent-glow">
                            Up to ~{formatPackVal(hit.valueUsd, null)}
                          </span>
                        ) : null
                      ) : (
                        <span className="font-mono tabular-nums text-accent-glow">{hit.displayValue}</span>
                      )}
                      {hit.marketCapUsd != null ? (
                        <span className="text-fg-muted">MC {formatPackMc(hit.marketCapUsd)}</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-fg-muted">
            &ldquo;Up to&rdquo; is the best-case pull for that slot — the bigger the hit, the rarer
            it is. Cashback &amp; points boosts apply to your trading fees, not as cash.
          </p>
        </div>
      </div>
    </div>
  );
}
