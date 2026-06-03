import Link from 'next/link';
import { isCreatorDevLoginEnabled } from '@/lib/creators/devAuth';
import { readCreatorSessionFromCookies } from '@/lib/creators/session';
import { redirect } from 'next/navigation';

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readCreatorSessionFromCookies();
  if (session) redirect('/portal/dashboard');

  const sp = await searchParams;
  const error = sp.error;
  const devLogin = isCreatorDevLoginEnabled();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 text-fg-primary">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/pointer-bird.png" alt="" width={48} height={48} className="mx-auto h-12 w-auto" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Pointer Creator Portal</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          Clip Pointer on TikTok, Instagram, and X. Get paid by views — Discord is required for the program.
        </p>

        {error ? (
          <p className="mt-4 rounded-md border border-signal-bear/40 bg-signal-bear/10 px-3 py-2 text-[12px] text-signal-bear">
            {error === 'blacklisted'
              ? 'Your Discord account is not eligible for the creator program.'
              : error.includes('creators') || error.includes('schema cache') || error.includes('relation')
                ? 'Database not ready — paste scripts/creator-portal.sql in Supabase SQL editor, run scripts/reload-postgrest-schema.sql, then retry.'
                : `Sign-in failed: ${decodeURIComponent(error)}`}
          </p>
        ) : null}

        <a
          href="/api/creators/auth/discord"
          className="btn-press mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#5865F2] py-2.5 text-[13px] font-semibold text-white hover:brightness-110"
        >
          Log in with Discord
        </a>

        {devLogin ? (
          <div className="mt-4 space-y-2 rounded-md border border-dashed border-border-subtle p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">Dev test (no Discord)</p>
            <a
              href="/api/creators/auth/dev?role=creator&bootstrap=1"
              className="block w-full rounded-md border border-border-subtle py-2 text-[12px] font-semibold hover:bg-bg-hover"
            >
              Test as creator (pre-verified)
            </a>
            <a
              href="/api/creators/auth/dev?role=admin"
              className="block w-full rounded-md border border-border-subtle py-2 text-[12px] font-semibold hover:bg-bg-hover"
            >
              Test as admin
            </a>
          </div>
        ) : null}

        <Link href="/" className="mt-6 inline-block text-[12px] text-fg-muted hover:text-fg-secondary">
          ← Back to Pointer
        </Link>
      </div>
    </div>
  );
}
