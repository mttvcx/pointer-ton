'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { metallicTextStyle, type MetallicVariant } from '@/components/wallet/analytics/pnl-share/metallicStyles';

export function MetallicText({
  children,
  variant = 'body',
  theme = 'midnight',
  positive = true,
  className,
  style,
  as: Tag = 'span',
}: {
  children: ReactNode;
  variant?: MetallicVariant;
  theme?: ShareBackgroundPresetId;
  positive?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'div';
}) {
  return (
    <Tag
      className={cn(className)}
      style={{ ...metallicTextStyle(variant, theme, positive), ...style }}
    >
      {children}
    </Tag>
  );
}
