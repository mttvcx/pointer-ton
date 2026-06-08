'use client';

import type { CSSProperties } from 'react';
import { PnlMomentAmount, type PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { ChromePanel } from '@/components/wallet/analytics/pnl-share/ChromePanel';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { fitShareHeroFontSize } from '@/lib/share/pnlShareFormat';
import { themeMetallicGradient } from '@/lib/share/shareCardTheme';
import { PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
import { cn } from '@/lib/utils/cn';

export function PnLValueBox({
  amount,
  token,
  positive,
  theme = 'midnight',
  accent = 'teal',
  className,
  fontSize = PNL_SHARE_POS.heroAmount.fontSize,
  showToken = true,
  motionBasis,
  motionFrozen,
  motionRevealKey,
}: {
  amount: string;
  token: string;
  positive: boolean;
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  className?: string;
  fontSize?: number;
  showToken?: boolean;
  motionBasis?: PnlMomentBasis | null;
  motionFrozen?: boolean;
  motionRevealKey?: string;
}) {
  const tokenSize = PNL_SHARE_POS.heroAmount.tokenSize;
  const tokenLabel = showToken && !amount.includes('%') ? token : null;
  const fittedAmountSize = fitShareHeroFontSize(amount, tokenLabel, fontSize);
  const fittedTokenSize = Math.round(tokenSize * (fittedAmountSize / fontSize));

  const heroRow = (
    <>
      {motionBasis && showToken !== false ? (
        <PnlMomentAmount
          basis={motionBasis}
          fallbackText={amount}
          frozen={motionFrozen ?? false}
          revealKey={motionRevealKey ?? `${amount}|${token}`}
          positive={positive}
          className="shrink-0 font-mono font-black tabular-nums leading-none tracking-tight"
          style={{
            fontSize: fittedAmountSize,
            backgroundImage: themeMetallicGradient(theme),
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 8px rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <MetallicText
          variant="hero"
          theme={theme}
          accent={accent}
          positive={positive}
          className="shrink-0 font-mono font-black tabular-nums leading-none tracking-tight"
          style={{ fontSize: fittedAmountSize }}
        >
          {amount}
        </MetallicText>
      )}
      {tokenLabel ? (
        <MetallicText
          variant="title"
          theme={theme}
          accent={accent}
          className="shrink-0 font-mono font-bold tabular-nums uppercase leading-none opacity-95"
          style={{ fontSize: fittedTokenSize }}
        >
          {tokenLabel}
        </MetallicText>
      ) : null}
    </>
  );

  return (
    <ChromePanel
      intensity="strong"
      rounded="md"
      accent={accent}
      theme={theme}
      className={cn('px-8', className)}
      style={{ minHeight: PNL_SHARE_POS.heroBox.h }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
        aria-hidden
      />
      <div className="flex h-full min-h-[inherit] flex-nowrap items-center gap-5 overflow-hidden whitespace-nowrap py-5">
        {heroRow}
      </div>
    </ChromePanel>
  );
}
