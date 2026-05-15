import Link from 'next/link';
import { APP_NAME, APP_TAGLINE } from '@/lib/utils/constants';

/**
 * Marketing landing placeholder.
 * The real (auth-gated) app lives under `app/(app)/*`.
 *
 * TODO Phase 2: replace with real marketing page.
 */
export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent-primary-rgb)/0.15),transparent_60%)]" />

      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs uppercase tracking-[0.02em] text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shadow-glow-sm" />
        Phase 1 / Internal Alpha
      </span>

      <h1 className="text-xl font-semibold tracking-tight text-fg-primary">
        {APP_NAME}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-fg-secondary">{APP_TAGLINE}</p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/pulse"
          className="rounded-sm bg-accent-primary px-4 py-2 text-sm font-medium text-fg-inverse transition hover:bg-accent-glow hover:shadow-glow-sm"
        >
          Open Pulse
        </Link>
        <a
          href="https://github.com"
          className="rounded-sm border border-border-subtle px-4 py-2 text-sm text-fg-secondary transition hover:border-border-default hover:text-fg-primary"
        >
          Docs
        </a>
      </div>

      <p className="mt-12 tabular-nums text-xs text-fg-muted">
        Pulse / Token detail / Wallet tracking / AI co-pilot
      </p>
    </main>
  );
}
