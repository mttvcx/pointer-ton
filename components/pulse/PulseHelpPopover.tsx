'use client';

import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { PulseRecommendedSettingsModal } from '@/components/pulse/PulseRecommendedSettingsModal';
import { pulseIconBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { cn } from '@/lib/utils/cn';

/** Opens Axiom-style recommended settings — apply filters + display in one click. */
export function PulseHelpPopover() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Recommended settings"
        className={cn(pulseIconBtnCls, open && 'border-white/[0.12] bg-bg-hover/75 text-fg-primary')}
        aria-label="Recommended settings"
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      <PulseRecommendedSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
