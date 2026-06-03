'use client';

import { CopilotBriefPanel } from './CopilotBriefPanel';

/** Level 2 — centered answer card (compact elsewhere, tall on Pulse). */
export function CopilotStripBody({
  variant = 'compact',
  className,
}: {
  variant?: 'compact' | 'pulse';
  className?: string;
}) {
  return <CopilotBriefPanel variant="compact" size={variant} className={className} />;
}
