import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-base px-6 text-center text-fg-primary">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-accent-primary">
        <Compass className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold">Not found</p>
      <p className="max-w-sm text-[11px] leading-snug text-fg-secondary">
        The address or page you were looking for could not be resolved on Solana.
      </p>
      <Link
        href="/pulse"
        className="btn-press inline-flex items-center gap-1.5 rounded-md bg-accent-primary px-3 py-1.5 text-xs font-semibold text-fg-inverse transition hover:bg-accent-glow"
      >
        Back to Pulse
      </Link>
    </div>
  );
}
