'use client';

import type { PulseTokenBundle } from '@/types/tokens';
import {
  AXIOM_DEV_SOLD_BAD_MAX_PCT,
  formatAxiomPctCell,
  getAxiomSpriteBadFlags,
  getAxiomSpriteMetrics,
} from '@/lib/tokens/pulseAxiomSpriteMetrics';
import { PulseRichHover, DevFundedHoverPanel } from '@/components/tokens/PulseRichPopovers';
import { PulseLuminanceGlyph } from '@/components/tokens/PulseGlyphMask';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

/** Mini-tooltip styling shared by the snipers + bundle chips. */
const SPRITE_CHIP_TOOLTIP_CLASS = cn(
  'rounded-md border border-white/[0.08] bg-[#1a1a1a] px-2.5 py-1.5',
  'whitespace-nowrap text-[11.5px] font-normal text-white/80 shadow-lg shadow-black/50',
);

/** Luminance-sheet assets (shared shape); color comes from masked `bg-current`. */
const METRIC_ICON_BASE = [
  '/pulse/axiom-metric-0.png',
  '/pulse/axiom-metric-1.png',
  '/pulse/axiom-metric-2.png',
  '/pulse/axiom-metric-3.png',
  '/pulse/axiom-metric-4.png',
] as const;

type MetricChipTone = 'bull' | 'bear';

function AxiomMetricIcon({
  sheetSrc,
  px,
  tone,
}: {
  sheetSrc: string;
  px: number;
  tone: MetricChipTone;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0',
        tone === 'bear' ? 'text-signal-bear' : 'text-signal-bull opacity-95',
      )}
    >
      <PulseLuminanceGlyph src={sheetSrc} size={px} />
    </span>
  );
}

function metricChipTone(isBad: boolean): MetricChipTone {
  return isBad ? 'bear' : 'bull';
}

/** Axiom-style capsules: faint grey hairline, transparent fill — color only on glyph + %. */
function metricChipShellClass() {
  return cn(
    'inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.14] bg-transparent',
    'px-2 py-0.5 shadow-none outline-none ring-0',
    'transition-[border-color] duration-150 hover:border-white/[0.22]',
  );
}

function metricChipTextClass(tone: MetricChipTone) {
  return cn(
    'text-[11px] font-semibold tabular-nums leading-none',
    tone === 'bull' && 'text-signal-bull',
    tone === 'bear' && 'text-signal-bear',
  );
}

export function PulseRowAxiomSpriteStrip({
  bundle,
  socialGlyphPx,
}: {
  bundle: PulseTokenBundle;
  socialGlyphPx?: number;
}) {
  const basePx = socialGlyphPx ?? 22;
  const metricPx = Math.max(13, Math.min(20, Math.round(basePx * 0.85)));

  const m = getAxiomSpriteMetrics(bundle);
  const bad = getAxiomSpriteBadFlags(m);
  const devSold = m.devPct != null && m.devPct <= AXIOM_DEV_SOLD_BAD_MAX_PCT;
  const devTooFat = bad.dev && !devSold;

  const cells: {
    key: keyof typeof bad;
    title: string;
    iconIndex: number;
    text: string;
  }[] = [
    {
      key: 'top10',
      title: 'Top 10 holder concentration',
      iconIndex: 0,
      text: formatAxiomPctCell(m.top10Pct),
    },
    {
      key: 'dev',
      title: devSold
        ? 'Developer holdings — hover for seeded funding snapshot'
        : devTooFat
          ? 'Developer holding — very high insider allocation'
          : 'Developer holding percent',
      iconIndex: 1,
      text: formatAxiomPctCell(m.devPct),
    },
    {
      key: 'sniper',
      title: 'Snipers Holding',
      iconIndex: 2,
      text: formatAxiomPctCell(m.sniperPct),
    },
    {
      key: 'bundle',
      title: 'Bundle Holding',
      /** Triple-circle glyph — matches Axiom’s bundle pill (not the tombstone sheet). */
      iconIndex: 4,
      text: formatAxiomPctCell(m.bundlePct),
    },
  ];

  return (
    <div
      /**
       * `overflow-visible` (not `overflow-x-auto`) — when one axis is non-visible CSS
       * forces the other to clip too, which was eating the dev-pill hover panel that
       * renders below the strip. We render at most 4 chips so horizontal scroll isn't
       * needed; the row already prevents overflow via `min-w-0`.
       */
      className="inline-flex min-w-0 max-w-none flex-nowrap items-center gap-0.5 pt-px"
      aria-label="Launch metrics"
    >
      {cells.map((c) => {
        const idx = c.iconIndex as 0 | 1 | 2 | 3 | 4;
        const isBad = bad[c.key];
        const tone = metricChipTone(isBad);
        const sheetSrc = METRIC_ICON_BASE[idx];

        const inner = (
          <span className={metricChipShellClass()} aria-label={c.title}>
            <AxiomMetricIcon sheetSrc={sheetSrc} px={metricPx} tone={tone} />
            <span className={metricChipTextClass(tone)}>{c.text}</span>
          </span>
        );

        /** Dev pill ALWAYS opens the funding popup on hover — sold or not. */
        if (c.key === 'dev') {
          return (
            <PulseRichHover key={c.key} bare panel={<DevFundedHoverPanel bundle={bundle} />}>
              {inner}
            </PulseRichHover>
          );
        }

        /**
         * Snipers + Bundle chips get a styled Radix Tooltip (single-line text).
         * Uses the app-level `TooltipProvider` already wrapping the layout — no
         * second provider here. `delayDuration` on `Root` overrides the global default.
         */
        if (c.key === 'sniper' || c.key === 'bundle') {
          return (
            <Tooltip key={c.key} delayDuration={150}>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className={SPRITE_CHIP_TOOLTIP_CLASS}>
                {c.title}
              </TooltipContent>
            </Tooltip>
          );
        }

        return <span key={c.key}>{inner}</span>;
      })}
    </div>
  );
}
