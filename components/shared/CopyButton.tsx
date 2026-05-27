'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { toastCopyFailed, toastCopied, type CopyToastVariant } from '@/lib/ui/copyToast';
import { signalMintCopied } from '@/lib/clipboard/mintClipboardSignal';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { cn } from '@/lib/utils/cn';

interface CopyButtonProps {
  /** The string copied to clipboard. */
  value: string;
  /** Optional subtitle under the toast title (usually omitted for a clean one-liner). */
  toastLabel?: string;
  /** Defaults to inferring address vs text from the copied value. */
  toastVariant?: CopyToastVariant | 'auto';
  /** Wraps optional preview text/element (e.g. a shortened address). */
  children?: ReactNode;
  /** Tailwind override for outer wrapper. */
  className?: string;
  /** Tailwind override for icon-only button (no children). */
  iconClassName?: string;
  /** ARIA label, defaults to "Copy". */
  label?: string;
  /** Render-only-icon (no underlying text). */
  iconOnly?: boolean;
}

/**
 * Inline copy-to-clipboard button. Trader UIs need this on every address /
 * signature; centralizing the toast + checkmark feedback so the experience
 * is consistent across pages.
 */
export function CopyButton({
  value,
  toastLabel,
  toastVariant = 'auto',
  children,
  className,
  iconClassName,
  label = 'Copy',
  iconOnly = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      if (isValidTokenMintParam(value)) signalMintCopied(value);
      setCopied(true);
      toastCopied(value, {
        variant: toastVariant === 'auto' ? undefined : toastVariant,
        preview: toastLabel,
      });
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toastCopyFailed();
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={handleCopy}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-all duration-150 hover:bg-bg-hover hover:text-fg-primary',
          iconClassName,
        )}
      >
        {copied ? <Check className="h-3 w-3 text-signal-bull" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={handleCopy}
      className={cn(
        'group inline-flex items-center gap-1 rounded text-fg-secondary transition-all duration-150 hover:text-fg-primary',
        className,
      )}
    >
      {children}
      {copied ? (
        <Check className="h-3 w-3 text-signal-bull" />
      ) : (
        <Copy className="h-3 w-3 text-fg-muted opacity-0 transition group-hover:opacity-100" />
      )}
    </button>
  );
}
