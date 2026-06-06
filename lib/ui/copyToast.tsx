'use client';

import { Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { looksLikeSolanaAddress } from '@/lib/utils/addresses';
import { toastPlacement } from '@/lib/ui/toastLayout';

export type CopyToastVariant = 'address' | 'text';

export type ToastCopiedOptions = {
  variant?: CopyToastVariant;
  /** Optional subtitle; keep short — callers usually omit for a single-line toast. */
  preview?: string;
};

function inferVariant(value: string): CopyToastVariant {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return 'text';
  if (isValidTokenMintParam(v)) return 'address';
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return 'address';
  if (looksLikeSolanaAddress(v)) return 'address';
  return 'text';
}

/**
 * Standard Pointer feedback for clipboard writes — top-center, clipboard icon, dismiss control.
 */
export function toastCopied(value: string, opts?: ToastCopiedOptions) {
  const variant = opts?.variant ?? inferVariant(value);
  const title =
    variant === 'address' ? 'Address copied to clipboard' : 'Copied to clipboard';
  const placement = toastPlacement('copy');

  toast.success(title, {
    description: opts?.preview?.trim() || undefined,
    icon: <Clipboard className="h-4 w-4 shrink-0 text-fg-secondary" strokeWidth={2.25} aria-hidden />,
    position: placement,
    duration: 3200,
    closeButton: true,
    classNames: {
      // Match the wallet-tracker notification toast theme (see
      // components/walletTracker/WalletTrackerTradeToast.tsx) — clean dark
      // surface, faint white hairline, soft shadow + blur. No green outline.
      toast:
        '!rounded-lg !border !border-white/[0.09] !bg-bg-raised/95 !shadow-[0_18px_48px_-16px_rgba(0,0,0,0.85)] !backdrop-blur-md',
      title: '!text-fg-primary !font-medium',
      description: '!text-fg-secondary',
    },
  });
}

export function toastCopyFailed(message = 'Clipboard access denied.') {
  const placement = toastPlacement('copy');

  toast.error('Copy failed', {
    description: message,
    position: placement,
    duration: 3200,
    closeButton: true,
    classNames: {
      toast:
        '!rounded-lg !border !border-white/[0.09] !bg-bg-raised/95 !shadow-[0_18px_48px_-16px_rgba(0,0,0,0.85)] !backdrop-blur-md',
      title: '!text-signal-bear !font-medium',
      description: '!text-fg-secondary',
    },
  });
}
