'use client';

import type { AppChainId } from '@/lib/chains/appChain';
import { QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';
import { PulseCompactHoverAbove } from '@/components/tokens/PulseRichPopovers';
import { quotePairHoverLabel, quoteTokenLabel } from '@/lib/tokens/quoteToken';
import { cn } from '@/lib/utils/cn';

/** Axiom-style quote chip — icon-only on Pulse rows; pill + label on token header. */
export function QuotePairBadge({
  kind,
  chain = 'sol',
  variant = 'icon',
  iconPx,
}: {
  kind: 'usdc' | 'usd1';
  chain?: AppChainId;
  /** `icon` = Pulse row (logo only). `header` = token page pill with label. */
  variant?: 'icon' | 'header';
  /** Pulse row icon size — defaults to 14px. */
  iconPx?: number;
}) {
  const label = quoteTokenLabel(kind, chain);
  const hoverLabel = quotePairHoverLabel(kind, chain);
  const headerIconPx = 12;
  const pulseIconPx = iconPx ?? 14;

  if (variant === 'icon') {
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
          className="inline-flex shrink-0 cursor-default items-center justify-center"
          aria-label={hoverLabel}
          role="img"
        >
          <QuoteTokenIcon
            kind={kind}
            chain={chain}
            className="shrink-0 object-contain"
            style={{ width: pulseIconPx, height: pulseIconPx }}
          />
        </span>
      </PulseCompactHoverAbove>
    );
  }

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
          'inline-flex shrink-0 cursor-default items-center gap-0.5 rounded-full border bg-transparent px-1 py-0.5',
          kind === 'usdc' ? 'border-[#2775CA]/55' : 'border-[#C4A35A]/55',
        )}
        aria-label={hoverLabel}
        role="img"
      >
        <QuoteTokenIcon
          kind={kind}
          chain={chain}
          className="shrink-0 object-contain"
          style={{ width: headerIconPx, height: headerIconPx }}
        />
        <span
          className={cn(
            'shrink-0 pr-0.5 text-[10.5px] font-semibold leading-none tracking-tight',
            kind === 'usdc' ? 'text-[#5ebbff]' : 'text-[#E8C872]',
          )}
        >
          {label}
        </span>
      </span>
    </PulseCompactHoverAbove>
  );
}
