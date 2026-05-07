/** Sentry DSN (same value server + client). Optional: leave unset to disable. */
export function getSentryDsn(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim() || undefined
  );
}

export function getSentryEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.VERCEL_ENV || process.env.NODE_ENV;
}
