'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { glassPanelStyle } from '@/components/wallet/analytics/pnl-share/metallicStyles';

export function ChromePanel({
  children,
  className,
  style,
  intensity = 'medium',
  rounded = 'md',
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: 'soft' | 'medium' | 'strong';
  rounded?: 'sm' | 'md' | 'lg';
}) {
  const radius = rounded === 'sm' ? 8 : rounded === 'lg' ? 20 : 14;
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ ...glassPanelStyle(intensity), borderRadius: radius, ...style }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, transparent 28%, transparent 72%, rgba(255,255,255,0.06) 100%)',
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
