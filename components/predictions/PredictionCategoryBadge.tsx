'use client';

import type { PredictionCategory } from '@/lib/predictions/marketsDemo';
import { cn } from '@/lib/utils/cn';

const categoryTone: Record<
  PredictionCategory,
  { bg: string; text: string; ring: string }
> = {
  Crypto: { ring: 'ring-cyan-400/22', bg: 'bg-cyan-500/[0.1]', text: 'text-cyan-200/95' },
  Macro: { ring: 'ring-amber-400/22', bg: 'bg-amber-500/[0.1]', text: 'text-amber-200/95' },
  Politics: { ring: 'ring-violet-400/22', bg: 'bg-violet-500/[0.11]', text: 'text-violet-200/95' },
  AI: { ring: 'ring-emerald-400/20', bg: 'bg-emerald-500/[0.1]', text: 'text-emerald-200/92' },
  Stocks: { ring: 'ring-sky-400/18', bg: 'bg-sky-500/[0.1]', text: 'text-sky-200/92' },
  Sports: { ring: 'ring-rose-400/18', bg: 'bg-rose-500/[0.1]', text: 'text-rose-200/92' },
  ETFs: { ring: 'ring-blue-400/22', bg: 'bg-blue-500/[0.1]', text: 'text-blue-100/93' },
};

export function PredictionCategoryBadge({
  category,
  className,
}: {
  category: PredictionCategory;
  className?: string;
}) {
  const tone = categoryTone[category];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide ring-1',
        tone.bg,
        tone.text,
        tone.ring,
        className,
      )}
    >
      {category}
    </span>
  );
}
