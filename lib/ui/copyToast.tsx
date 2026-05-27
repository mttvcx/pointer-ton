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
    icon: <Clipboard className="h-4 w-4 shrink-0 text-accent-primary" strokeWidth={2.25} aria-hidden />,
    position: placement,
    duration: 3200,
    closeButton: true,
    classNames: {
      toast: '!bg-bg-base !border-[rgb(var(--signal-bull-rgb)/0.45)]',
      title: '!text-signal-bull',
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
  });
}
