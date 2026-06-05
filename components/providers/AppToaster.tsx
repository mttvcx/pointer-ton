'use client';

import { Toaster } from 'sonner';
import { toastOffset, useToastAnchorRight } from '@/lib/ui/toastLayout';
import { cn } from '@/lib/utils/cn';
import { useShellPrefsStore } from '@/store/shellPrefs';

/** Primary app toaster — shifts top-right while the co-pilot answer strip is open. */
export function AppToaster() {
  const anchorRight = useToastAnchorRight();
  const toastPosition = useShellPrefsStore((s) => s.toastPosition);
  const placement = anchorRight ? 'top-right' : toastPosition;

  return (
    <Toaster
      theme="dark"
      position={placement}
      className={cn('toaster-app', anchorRight && 'toaster-app--answer-open')}
      richColors
      offset={toastOffset(placement)}
      toastOptions={{
        classNames: {
          toast: 'border border-border-subtle text-fg-primary !bg-bg-base',
          title: 'text-sm font-medium',
          description: 'text-xs text-fg-secondary',
          success: '!border-[rgb(var(--signal-bull-rgb)/0.45)] !text-signal-bull',
        },
      }}
    />
  );
}
