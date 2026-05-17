'use client';

import type { PulseTokenBundle } from '@/types/tokens';
import {
  AXIOM_DEV_SOLD_BAD_MAX_PCT,
  formatAxiomPctCell,
  getAxiomSpriteBadFlags,
  getAxiomSpriteMetrics,
} from '@/lib/tokens/pulseAxiomSpriteMetrics';
import { PulseRichHover, DevFundedHoverPanel } from '@/components/tokens/PulseRichPopovers';
import { cn } from '@/lib/utils/cn';

/** Individual PNG assets (left→right: star/person, chef, crosshair, tomb, triple circles). */
const METRIC_ICON_GREEN = [
  '/pulse/axiom-metric-0.png',
  '/pulse/axiom-metric-1.png',
  '/pulse/axiom-metric-2.png',
  '/pulse/axiom-metric-3.png',
  '/pulse/axiom-metric-4.png',
] as const;

const METRIC_ICON_RED = [
  '/pulse/axiom-metric-0-red.png',
  '/pulse/axiom-metric-1-red.png',
  '/pulse/axiom-metric-2-red.png',
  '/pulse/axiom-metric-3-red.png',
  '/pulse/axiom-metric-4-red.png',
] as const;

type MetricChipTone = 'bull' | 'bear';

function AxiomMetricIcon({
  src,
  px,
  danger,
}: {
  src: string;
  px: number;
  danger?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      decoding="async"
      draggable={false}
      className={cn(
        'shrink-0 object-contain',
        danger && 'drop-shadow-[0_0_8px_rgba(251,113,133,0.35)]',
      )}
      style={{ width: px, height: px }}
      aria-hidden
    />
  );
}

/**
 * Pill chip — grey outline only; icon + value always carry their semantic color
 * (green for healthy / `bull`, red for flagged / `bear`). Zero values keep the
 * bull green so the strip stays Axiom-style instead of going muted.
 */
function metricChipTone(isBad: boolean): MetricChipTone {
  return isBad ? 'bear' : 'bull';
}

function metricChipShellClass(_tone: MetricChipTone) {
  // Pill ~10% tighter than the previous pass — readable but no longer dominant.
  return 'inline-flex shrink-0 items-center gap-1 rounded-full border border-border-subtle bg-transparent px-2 py-0.5 shadow-none outline-none ring-0';
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
  /**
   * Bottom strip — Axiom-style readable cluster. ~10% smaller than the previous
   * pass: glyph at ~85% of the social-strip glyph so the row stays secondary
   * vs. the social icons above. Clamps [13, 20].
   */
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
    devHover?: boolean;
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
        ? 'Developer holding — hover for funding snapshot'
        : devTooFat
          ? 'Developer holding — very high insider allocation'
          : 'Developer holding %',
      iconIndex: 1,
      text: formatAxiomPctCell(m.devPct),
      devHover: devSold,
    },
    {
      key: 'sniper',
      title: 'Sniper / fast-wallet allocation (when reported)',
      iconIndex: 2,
      text: formatAxiomPctCell(m.sniperPct),
    },
    {
      key: 'bundle',
      title: 'Bundle / band allocation (when reported)',
      iconIndex: 3,
      text: formatAxiomPctCell(m.bundlePct),
    },
    {
      key: 'cluster',
      title: 'Cluster / linked-wallet signal (when reported)',
      iconIndex: 4,
      text: formatAxiomPctCell(m.clusterPct),
    },
  ];

  return (
    <div
      className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto pt-px [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Launch metrics"
    >
      {cells.map((c) => {
        const idx = c.iconIndex as 0 | 1 | 2 | 3 | 4;
        const isBad = bad[c.key];
        const tone = metricChipTone(isBad);
        const iconSrc = isBad ? METRIC_ICON_RED[idx] : METRIC_ICON_GREEN[idx];

        const inner = (
          <span className={metricChipShellClass(tone)} title={c.title}>
            <AxiomMetricIcon
              src={iconSrc}
              px={metricPx}
              danger={isBad}
            />
            <span className={metricChipTextClass(tone)}>{c.text}</span>
          </span>
        );

        if (c.devHover) {
          return (
            <PulseRichHover key={c.key} panel={<DevFundedHoverPanel bundle={bundle} />}>
              {inner}
            </PulseRichHover>
          );
        }

        return <span key={c.key}>{inner}</span>;
      })}
    </div>
  );
}
