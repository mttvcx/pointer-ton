'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/** Root segment error boundary — must not render `<html>` / `<body>` (see `app/global-error.tsx`). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pointer] root error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-signal-bear/40 bg-signal-bear/10 text-signal-bear">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-fg-primary">Something broke</p>
      <p className="max-w-md text-[12px] text-fg-secondary">
        Pointer hit an unexpected error. We logged it.
      </p>
      {error?.message ? (
        <p className="max-w-md break-words tabular-nums text-[11px] text-fg-muted">
          {error.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="btn-press mt-1 inline-flex items-center gap-1.5 rounded-md bg-accent-primary px-3 py-1.5 text-xs font-semibold text-fg-inverse transition hover:bg-accent-glow"
      >
        <RotateCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}
