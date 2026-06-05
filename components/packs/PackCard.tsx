'use client';

import type { PackPublicConfig, PackType } from '@/types/pack';
import { PACK_VISUAL } from '@/lib/packs/rarityTheme';
import { PackFoilDesign } from '@/components/packs/PackFoilDesign';
import { PackSolAmount } from '@/components/packs/PackSolAmount';
import { cn } from '@/lib/utils/cn';

type PackCardProps = {
  config: PackPublicConfig;
  onSelect: () => void;
  onDetails: () => void;
};

/** Subtle inset tint on hover — no large outer glow (avoids white/purple bleed in grid gutters). */
const SHELF_HOVER: Record<PackType, string> = {
  bronze: 'hover:border-amber-700/25',
  silver: 'hover:border-sky-400/25',
  gold: 'hover:border-amber-300/30',
  legendary: 'hover:border-violet-400/35',
};

export function PackCard({ config, onSelect, onDetails }: PackCardProps) {
  const vis = PACK_VISUAL[config.type];

  return (
    <article
      className={cn(
        'pack-tcg-shelf group relative isolate overflow-hidden rounded-md border border-white/[0.06] bg-[#040508] transition-[border-color,transform] duration-400',
        SHELF_HOVER[config.type],
        config.type === 'legendary' && 'border-violet-400/20',
      )}
    >
      <div className="relative flex min-h-[400px] flex-col p-4 sm:p-5">
        <header className="text-center">
          <h2
            className={cn(
              'text-2xl font-bold uppercase tracking-[0.16em] sm:text-[28px]',
              vis.accent,
            )}
          >
            {config.label}
          </h2>
        </header>

        <div className="my-5 flex flex-1 items-center justify-center overflow-hidden [perspective:1200px]">
          <div className="pack-tcg-lift relative h-[13.5rem] w-[9.25rem] overflow-hidden rounded-[12px]">
            <div className={cn('pack-shelf-shell h-full w-full overflow-hidden', `pack-shelf-shell--${config.type}`)}>
              <div className="relative h-full w-full overflow-hidden rounded-[10px]">
                <PackFoilDesign type={config.type} label={config.label} variant="shelf" />
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
