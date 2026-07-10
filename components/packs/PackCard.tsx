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

/** Per-tier outer hue on the shelf card rectangle (border + colored glow). */
const SHELF_HOVER: Record<PackType, string> = {
  bronze:
    'hover:border-amber-600/45 hover:shadow-[0_0_0_1px_rgba(212,165,116,0.38),0_0_40px_-6px_rgba(180,120,60,0.48),0_24px_80px_-24px_rgba(120,80,40,0.42)]',
  silver:
    'hover:border-sky-400/40 hover:shadow-[0_0_0_1px_rgba(147,197,253,0.35),0_0_40px_-6px_rgba(56,189,248,0.42),0_24px_80px_-24px_rgba(56,189,248,0.38)]',
  gold:
    'hover:border-amber-400/45 hover:shadow-[0_0_0_1px_rgba(253,224,71,0.42),0_0_44px_-6px_rgba(251,191,36,0.52),0_28px_90px_-20px_rgba(251,191,36,0.48)]',
  diamond:
    'hover:border-cyan-300/50 hover:shadow-[0_0_0_1px_rgba(165,243,252,0.44),0_0_46px_-6px_rgba(34,211,238,0.55),0_30px_96px_-18px_rgba(34,211,238,0.5)]',
  legendary:
    'hover:border-violet-400/55 hover:shadow-[0_0_0_1px_rgba(216,180,254,0.48),0_0_48px_-6px_rgba(147,51,234,0.58),0_32px_100px_-16px_rgba(147,51,234,0.52)]',
};

const SHELF_BORDER: Record<PackType, string> = {
  bronze: 'border-amber-900/25',
  silver: 'border-sky-900/30',
  gold: 'border-amber-500/20',
  diamond: 'border-cyan-400/25',
  legendary: 'border-violet-400/25',
};

export function PackCard({ config, onSelect, onDetails }: PackCardProps) {
  const vis = PACK_VISUAL[config.type];

  return (
    <article
      className={cn(
        'pack-tcg-shelf group relative isolate overflow-visible rounded-md border bg-[#070810]/55 backdrop-blur-md transition-[border-color,box-shadow] duration-400',
        SHELF_BORDER[config.type],
        SHELF_HOVER[config.type],
        `pack-tcg-shelf--${config.type}`,
      )}
    >
      <div className="relative flex min-h-[400px] flex-col p-4 sm:p-5">
        <header className="relative z-10 shrink-0 text-center">
          <h2
            className={cn(
              'text-[26px] uppercase leading-none sm:text-[30px]',
              `pack-title--${config.type}`,
              vis.accent,
            )}
          >
            {config.label}
          </h2>
        </header>

        <div className="pack-tcg-stage relative z-0 my-2 flex flex-1 items-center justify-center overflow-visible px-1">
          <div className={cn('pack-glow', `pack-glow--${config.type}`)} aria-hidden />
          <div className="pack-pedestal" aria-hidden />
          <div className="relative z-[1] h-[17.5rem] w-full">
            <PackFoilDesign type={config.type} label={config.label} variant="shelf" />
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
