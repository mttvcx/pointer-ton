'use client';

import type { PackPublicConfig } from '@/types/pack';
import { PACK_POINTER_LOGO } from '@/lib/packs/constants';
import { PACK_VISUAL } from '@/lib/packs/rarityTheme';
import { PackSolAmount } from '@/components/packs/PackSolAmount';
import { cn } from '@/lib/utils/cn';

type PackCardProps = {
  config: PackPublicConfig;
  onSelect: () => void;
  onDetails: () => void;
};

export function PackCard({ config, onSelect, onDetails }: PackCardProps) {
  const vis = PACK_VISUAL[config.type];

  return (
    <article
      className={cn(
        'pack-tcg-shelf group relative overflow-hidden rounded-sm border bg-[#06080d] transition-[border-color,box-shadow] duration-300',
        vis.border,
        'hover:border-white/25 hover:shadow-[0_32px_90px_-28px_rgba(88,101,242,0.45)]',
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', vis.gradient)} />
      <div className="pack-card-shine pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex min-h-[360px] flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', vis.accent)}>
              {config.label}
            </p>
            <p className="mt-1 max-w-[14rem] text-[13px] leading-snug text-fg-secondary">{config.tagline}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/15 bg-black/30 shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PACK_POINTER_LOGO} alt="" className="h-8 w-8 object-contain" draggable={false} />
          </div>
        </div>

        <div className="my-5 flex flex-1 items-center justify-center pt-2 [perspective:900px]">
          <div className="pack-tcg-lift relative h-44 w-32">
            <div
              className={cn(
                'relative h-full w-full overflow-hidden rounded-sm border-2 shadow-2xl',
                vis.border,
                vis.glow,
              )}
            >
              <div className={cn('absolute inset-0 bg-gradient-to-br', vis.gradient)} />
              <div className="pack-foil-shine pack-foil-shine--hover-only pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex h-full flex-col">
                <div className="flex flex-1 items-center justify-center p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PACK_POINTER_LOGO} alt="" className="h-16 w-16 object-contain" draggable={false} />
                </div>
                <div className="border-t border-white/10 bg-black/35 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Pointer</p>
                  <p className="text-sm font-semibold text-white">{config.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-fg-muted">Price</span>
            <PackSolAmount amount={config.packPriceSol} size="md" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 opacity-100 transition lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:group-hover:max-h-40 lg:group-hover:opacity-100">
          {config.odds.slice(0, 4).map((row) => (
            <div
              key={row.rarity}
              className="flex items-center justify-between rounded-sm bg-black/25 px-2 py-1 text-[10px]"
            >
              <span className="capitalize text-fg-muted">{row.rarity}</span>
              <span className="font-mono tabular-nums text-fg-secondary">{row.probabilityPct}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'btn-press focus-ring mt-4 w-full rounded-sm py-2.5 text-sm font-semibold text-white',
            'bg-gradient-to-b from-[#6b77f7] to-[#5865F2] shadow-[0_10px_30px_-12px_rgba(88,101,242,0.8)] hover:brightness-110',
          )}
        >
          Open {config.label}
        </button>
        <button
          type="button"
          onClick={onDetails}
          className="btn-press focus-ring mt-2 w-full rounded-sm py-2 text-[12px] font-medium text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary"
        >
          Pack details
        </button>
      </div>
    </article>
  );
}
