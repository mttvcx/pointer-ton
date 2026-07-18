'use client';

import { CopilotBriefPanel } from './CopilotBriefPanel';
import { DraggableBrief } from './DraggableBrief';

/** Level 2 — centered answer card (compact elsewhere, tall on Pulse). Draggable side-to-side. */
export function CopilotStripBody({
  variant = 'compact',
  className,
}: {
  variant?: 'compact' | 'pulse';
  className?: string;
}) {
  return (
    <DraggableBrief>
      <CopilotBriefPanel variant="compact" size={variant} className={className} />
    </DraggableBrief>
  );
}
