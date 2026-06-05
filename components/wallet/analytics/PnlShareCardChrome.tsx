'use client';

import { PointerNeonBird } from '@/components/wallet/analytics/PointerNeonBird';
import { shareCardTheme } from '@/lib/share/shareCardTheme';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

/** Neon bird only — used when compositing over user-uploaded image/video. */
export function PnlShareCardChrome({
  backgroundId,
  className,
}: {
  backgroundId: ShareBackgroundPresetId;
  className?: string;
}) {
  const theme = shareCardTheme(backgroundId);
  const birdGlow =
    backgroundId === 'glacier' ? 'cyan' : backgroundId === 'onyx' ? 'mono' : 'violet';

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-y-[-2%] right-[-6%] z-[1] flex items-center">
        <PointerNeonBird glow={birdGlow} className="h-[128%] w-auto opacity-[0.98]" />
      </div>
    </div>
  );
}
