'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { getSentryDsn } from '@/lib/sentry/env';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (getSentryDsn()) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base px-4 text-fg-primary">
        <h1 className="text-base font-semibold">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-fg-secondary">
          An unexpected error occurred. Try again, or refresh the page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-sm border border-border-subtle px-4 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-bg-hover"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
