'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { metallicTextStyle, type MetallicVariant } from '@/components/wallet/analytics/pnl-share/metallicStyles';

export function MetallicText({
  children,
  variant = 'body',
  theme = 'midnight',
  accent = 'teal',
  positive = true,
  className,
  style,
  as: Tag = 'span',
}: {
  children: ReactNode;
  variant?: MetallicVariant;
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  positive?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'div';
}) {
  return (
    <Tag
      className={cn(className)}
      style={{ ...metallicTextStyle(variant, theme, positive, accent), ...style }}
    >
      {children}
    </Tag>
  );
}
