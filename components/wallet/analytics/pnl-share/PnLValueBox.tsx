'use client';

import type { CSSProperties } from 'react';
import { PnlMomentAmount, type PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { ChromePanel } from '@/components/wallet/analytics/pnl-share/ChromePanel';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

const HERO_METALLIC: CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, #ffffff 0%, #e8e8ec 18%, #a8aab4 42%, #f0f0f4 58%, #8a8c98 78%, #ffffff 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  textShadow: '0 0 40px rgba(255,255,255,0.25), 0 4px 12px rgba(0,0,0,0.65)',
};

export function PnLValueBox({
  amount,
  token,
  positive,
  theme = 'midnight',
  className,
  fontSize = 88,
  motionBasis,
  motionFrozen,
  motionRevealKey,
}: {
  amount: string;
  token: string;
  positive: boolean;
  theme?: ShareBackgroundPresetId;
  className?: string;
  fontSize?: number;
  motionBasis?: PnlMomentBasis | null;
  motionFrozen?: boolean;
  motionRevealKey?: string;
}) {
  return (
    <ChromePanel intensity="strong" rounded="md" className={cn('px-8 py-5', className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }}
        aria-hidden
      />
      <div className="flex items-baseline gap-4">
        {motionBasis ? (
          <>
            <PnlMomentAmount
              basis={motionBasis}
              fallbackText={motionBasis.kind === 'sol' ? `${amount} ${token}` : amount}
              frozen={motionFrozen ?? false}
              revealKey={motionRevealKey ?? `${amount}|${token}`}
              positive={positive}
              className="font-mono font-black tabular-nums leading-none tracking-tight"
              style={{ ...HERO_METALLIC, fontSize }}
            />
            {motionBasis.kind === 'usd' ? (
              <MetallicText
                variant="title"
                theme={theme}
                className="font-mono text-[42px] font-bold tabular-nums uppercase leading-none opacity-90"
              >
                {token}
              </MetallicText>
            ) : null}
          </>
        ) : (
          <>
            <MetallicText
              variant="hero"
              theme={theme}
              positive={positive}
              className="font-mono font-black tabular-nums leading-none tracking-tight"
              style={{ fontSize, textShadow: '0 0 40px rgba(255,255,255,0.25), 0 4px 12px rgba(0,0,0,0.65)' }}
            >
              {amount}
            </MetallicText>
            <MetallicText
              variant="title"
              theme={theme}
              className="font-mono text-[42px] font-bold tabular-nums uppercase leading-none opacity-90"
            >
              {token}
            </MetallicText>
          </>
        )}
      </div>
    </ChromePanel>
  );
}
