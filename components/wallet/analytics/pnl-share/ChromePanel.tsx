'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { glassPanelStyle } from '@/components/wallet/analytics/pnl-share/metallicStyles';

export function ChromePanel({
  children,
  className,
  style,
  intensity = 'medium',
  rounded = 'md',
  accent = 'teal',
  theme = 'midnight',
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: 'soft' | 'medium' | 'strong';
  rounded?: 'sm' | 'md' | 'lg';
  accent?: OverlayAccent;
  theme?: ShareBackgroundPresetId;
}) {
  const radius = rounded === 'sm' ? 8 : rounded === 'lg' ? 20 : 14;
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ ...glassPanelStyle(intensity, accent, theme), borderRadius: radius, ...style }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.12) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)',
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
