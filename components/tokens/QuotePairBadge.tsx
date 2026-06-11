'use client';

import type { AppChainId } from '@/lib/chains/appChain';
import { QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';
import { PulseCompactHoverAbove } from '@/components/tokens/PulseRichPopovers';
import { quotePairHoverLabel, quoteTokenLabel } from '@/lib/tokens/quoteToken';
import { cn } from '@/lib/utils/cn';

/** Axiom-style quote chip — blue outline, logo + label, UI hover (no native title). */
export function QuotePairBadge({
  kind,
  chain = 'sol',
  variant = 'row',
}: {
  kind: 'usdc' | 'usd1';
  chain?: AppChainId;
  variant?: 'row' | 'header';
}) {
  const label = quoteTokenLabel(kind, chain);
  const hoverLabel = quotePairHoverLabel(kind, chain);
  const iconPx = variant === 'header' ? 12 : 11;

  return (
    <PulseCompactHoverAbove
      placement="below"
      openDelayMs={90}
      closeDelayMs={90}
      content={
        <p className="text-[11px] font-semibold leading-none text-fg-primary">{hoverLabel}</p>
      }
    >
      <span
        className={cn(
          'inline-flex shrink-0 cursor-default items-center gap-0.5 rounded-full border bg-transparent',
          kind === 'usdc'
            ? 'border-[#2775CA]/55'
            : 'border-[#C4A35A]/55',
          variant === 'header' ? 'px-1 py-0.5' : 'px-0.5 py-px',
        )}
        aria-label={hoverLabel}
        role="img"
      >
        <QuoteTokenIcon
          kind={kind}
          chain={chain}
          className="shrink-0 object-contain"
          style={{ width: iconPx, height: iconPx }}
        />
        <span
          className={cn(
            'shrink-0 pr-0.5 font-semibold leading-none tracking-tight',
            kind === 'usdc' ? 'text-[#5ebbff]' : 'text-[#E8C872]',
            variant === 'header' ? 'text-[10.5px]' : 'text-[10px]',
          )}
        >
          {label}
        </span>
      </span>
    </PulseCompactHoverAbove>
  );
}
