'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-bg-base px-6 text-fg-primary">
        <div className="w-full max-w-md border border-border-subtle p-6">
          <div className="flex items-center gap-2 text-signal-bear">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.02em]">
              Something broke
            </span>
          </div>
          <p className="mt-3 text-sm text-fg-primary">
            Pointer hit an unexpected error. We logged it.
          </p>
          {error?.message ? (
            <p className="mt-2 break-words tabular-nums text-[11px] text-fg-secondary">
              {error.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="btn-press mt-5 inline-flex items-center gap-1.5 rounded-md bg-accent-primary px-3 py-1.5 text-xs font-semibold text-fg-inverse transition hover:bg-accent-glow"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
