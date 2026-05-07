'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pointer] app error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-signal-bear/40 bg-signal-bear/10 text-signal-bear">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-fg-primary">This page hit an error</p>
      {error?.message ? (
        <p className="max-w-md break-words tabular-nums text-[11px] text-fg-secondary">
          {error.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="btn-press mt-1 inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-[11px] font-semibold text-fg-secondary transition hover:border-accent-primary/40 hover:text-fg-primary"
      >
        <RotateCw className="h-3 w-3" />
        Try again
      </button>
    </div>
  );
}
