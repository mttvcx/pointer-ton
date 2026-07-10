'use client';

import type { PackType } from '@/types/pack';
import { PACK_ART_IDENTITY } from '@/lib/packs/packArtIdentity';
import { PACK_POINTER_LOGO } from '@/lib/packs/constants';
import { packRenderImage } from '@/lib/packs/packRenderArt';
import { PackFoilArtLayer } from '@/components/packs/packFoilArtLayers';
import { cn } from '@/lib/utils/cn';

export type PackFoilVariant = 'shelf' | 'open';

function DecorativeChips({ type }: { type: PackType }) {
  const { chips } = PACK_ART_IDENTITY[type];
  const positions: Record<PackType, string[]> = {
    bronze: [
      'pack-chip--pos-tl',
      'pack-chip--pos-tr',
      'pack-chip--pos-bl',
    ],
    silver: [
      'pack-chip--pos-tl',
      'pack-chip--pos-mr',
      'pack-chip--pos-bl',
    ],
    gold: [
      'pack-chip--pos-tl',
      'pack-chip--pos-br',
      'pack-chip--pos-mr',
    ],
    diamond: [
      'pack-chip--pos-tl',
      'pack-chip--pos-tr',
      'pack-chip--pos-bl',
    ],
    legendary: [
      'pack-chip--pos-tl',
      'pack-chip--pos-tr',
      'pack-chip--pos-br',
    ],
  };

  return (
    <>
      {chips.map((chip, i) => (
        <span
          key={chip.text}
          className={cn(
            'pack-chip pointer-events-none absolute z-[7] font-mono font-semibold uppercase tracking-wide',
            `pack-chip--${type}`,
            positions[type][i],
          )}
        >
          {chip.text}
        </span>
      ))}
    </>
  );
}

function HeroCallout({ type }: { type: PackType }) {
  const { heroCallout } = PACK_ART_IDENTITY[type];
  if (!heroCallout) return null;
  return (
    <div className={cn('pack-hero-callout pointer-events-none absolute z-[8]', `pack-hero-callout--${type}`)}>
      <span className="pack-hero-callout__text font-mono font-bold tabular-nums tracking-tight">
        {heroCallout}
      </span>
    </div>
  );
}

function MicroLabel({ type }: { type: PackType }) {
  const { microLabel } = PACK_ART_IDENTITY[type];
  if (!microLabel) return null;
  return (
    <span className={cn('pack-micro-label pointer-events-none absolute z-[6]', `pack-micro-label--${type}`)}>
      {microLabel}
    </span>
  );
}

function LegendaryParticles() {
  return (
    <div className="pack-particles pointer-events-none absolute inset-0 z-[3]" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="pack-particle"
          style={{
            left: `${8 + (i * 17) % 84}%`,
            top: `${6 + (i * 23) % 78}%`,
            animationDelay: `${(i * 0.31) % 2.4}s`,
            animationDuration: `${2.2 + (i % 4) * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

export function PackFoilDesign({
  type,
  label,
  variant = 'shelf',
  className,
}: {
  type: PackType;
  label: string;
  variant?: PackFoilVariant;
  className?: string;
}) {
  const isOpen = variant === 'open';
  const isLegendary = type === 'legendary';
  const render = packRenderImage(type);

  // Premium path: the real 3D foil-pack render — crumpled foil, crimped ends,
  // title + pointer. + hero baked in. Floats freely (transparent cutout), no
  // frame, lifts on hover.
  if (render) {
    // Real 3D foil pack — crumpled foil, crimped bristly seals, title + hero all
    // baked into the render. Floats freely (transparent cutout), lifts on hover.
    return (
      <div className={cn('pack-render group/foil relative flex h-full w-full items-center justify-center', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={render}
          alt={`${label} pack`}
          className={cn(
            'h-full w-full object-contain drop-shadow-[0_26px_50px_rgba(0,0,0,0.62)] transition-transform duration-300 ease-out will-change-transform',
            isOpen ? 'scale-[1.05]' : 'scale-[1.08] group-hover/foil:-translate-y-2.5 group-hover/foil:scale-[1.16]',
          )}
          draggable={false}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pack-collectible group/foil relative overflow-hidden',
        `pack-collectible--${type}`,
        isOpen ? 'pack-collectible--open h-56 w-40' : 'pack-collectible--shelf h-full w-full',
        className,
      )}
    >
      <div className="pack-collectible__edge pointer-events-none absolute inset-0 z-[12]" aria-hidden />
      <div className="pack-collectible__bevel pointer-events-none absolute inset-0 z-[11]" aria-hidden />

      <div className="pack-collectible__canvas absolute inset-0 overflow-hidden">
        <PackFoilArtLayer type={type} />
        <div className="pack-collectible__mesh pointer-events-none absolute inset-0 z-[2]" aria-hidden />
        <div className="pack-collectible__vignette pointer-events-none absolute inset-0 z-[4]" aria-hidden />
        <div className="pack-collectible__specular pointer-events-none absolute inset-0 z-[5]" aria-hidden />

        {isLegendary ? <LegendaryParticles /> : null}

        <DecorativeChips type={type} />
        <HeroCallout type={type} />
        <MicroLabel type={type} />

        <div className="pack-collectible__crest absolute left-1/2 top-[42%] z-[9] -translate-x-1/2 -translate-y-1/2">
          <div
            className={cn(
              'pack-collectible__crest-ring flex items-center justify-center rounded-full',
              isOpen ? 'h-[4.25rem] w-[4.25rem]' : 'h-[3.75rem] w-[3.75rem]',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PACK_POINTER_LOGO}
              alt=""
              className={cn('object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]', isOpen ? 'h-9 w-9' : 'h-8 w-8')}
              draggable={false}
            />
          </div>
          <p className="pack-collectible__brand mt-1.5 text-center text-[7px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Pointer
          </p>
        </div>

        <footer className="pack-collectible__footer absolute bottom-0 left-0 right-0 z-[10]">
          <div className="pack-collectible__footer-inner px-2 py-2.5 text-center">
            <p
              className={cn(
                'pack-collectible__title font-semibold uppercase tracking-[0.12em]',
                isOpen ? 'text-[15px]' : 'text-[13px]',
              )}
            >
              {label}
            </p>
          </div>
        </footer>
      </div>

      <div
        className="pack-collectible__sheen pointer-events-none absolute inset-0 z-[13] opacity-0 transition-opacity duration-500"
        aria-hidden
      />
      {isOpen ? (
        <div className="pack-collectible__sheen pack-collectible__sheen--active pointer-events-none absolute inset-0 z-[13]" aria-hidden />
      ) : null}
    </div>
  );
}
