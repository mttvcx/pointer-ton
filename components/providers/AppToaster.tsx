'use client';

import { Toaster } from 'sonner';
import { toastOffset, useToastAnchorRight } from '@/lib/ui/toastLayout';
import { cn } from '@/lib/utils/cn';
import { useShellPrefsStore } from '@/store/shellPrefs';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import { toastSurfaceFrom } from '@/lib/ui/toastColor';

/** Primary app toaster — shifts top-right while the co-pilot answer strip is open. */
export function AppToaster() {
  const anchorRight = useToastAnchorRight();
  const toastPosition = useShellPrefsStore((s) => s.toastPosition);
  const placement = anchorRight ? 'top-right' : toastPosition;
  const surface = toastSurfaceFrom(usePulseDisplayPrefsStore((s) => s.toastColor));

  return (
    <Toaster
      theme="dark"
      position={placement}
      className={cn('toaster-app', anchorRight && 'toaster-app--answer-open')}
      richColors
      offset={toastOffset(placement)}
      duration={3000}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast: surface.custom ? 'border' : 'border border-border-subtle text-fg-primary !bg-bg-base',
          title: 'text-sm font-medium',
          description: cn('text-xs', !surface.custom && 'text-fg-secondary'),
          success: '!border-[rgb(var(--signal-bull-rgb)/0.45)] !text-signal-bull',
        },
        style: surface.custom
          ? { background: surface.bg, color: surface.fg, borderColor: surface.border }
          : undefined,
      }}
    />
  );
}
