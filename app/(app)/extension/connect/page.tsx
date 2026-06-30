'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

/**
 * Pointer Extension connect / approve screen. The user is already logged into
 * pointer.trade; they approve linking this browser extension. We mint a single-use
 * code server-side and hand it to the extension via `externally_connectable`
 * messaging — the scoped token is then minted on the extension's own server call,
 * so it never touches this page's JS.
 */
type Phase = 'idle' | 'authorizing' | 'sending' | 'done' | 'error';

export default function ExtensionConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <ConnectInner />
    </Suspense>
  );
}

function ConnectInner() {
  const params = useSearchParams();
  const extId = (params.get('ext') ?? '').trim();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const validExt = /^[a-z0-9._-]{8,64}$/i.test(extId);

  async function approve() {
    setError(null);
    setPhase('authorizing');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
      // Timeout so a backend hiccup fails fast instead of spinning "Connecting…" forever.
      const res = await fetch('/api/ext/auth/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ext: extId }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'authorize_failed');
      const { code } = (await res.json()) as { code: string };

      setPhase('sending');
      // Hand the one-time code to the extension (externally_connectable).
      const chromeRt = (globalThis as { chrome?: { runtime?: { sendMessage?: Function } } }).chrome
        ?.runtime?.sendMessage;
      if (typeof chromeRt !== 'function') {
        throw new Error('Open this from the Pointer extension (Connect button).');
      }
      // Backstop timeout: if the extension's background never calls back (asleep
      // service worker, hung exchange), don't hang — surface a retryable error.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('extension_timeout')),
          20_000,
        );
        chromeRt(extId, { pointerConnect: { code } }, (resp: { ok?: boolean } | undefined) => {
          clearTimeout(timer);
          if (resp?.ok) resolve();
          else reject(new Error('Extension did not accept the connection.'));
        });
      });
      setPhase('done');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Connection failed';
      // Map fail-fast signals to something a user can act on. Check the specific
      // extension-timeout case before the generic network-timeout regex.
      const friendly =
        raw === 'extension_timeout'
          ? 'The extension didn’t respond. Reload it (chrome://extensions) and try Connect again.'
          : /timeout|aborted|timed out|signal|networkerror|failed to fetch/i.test(raw)
            ? 'Pointer is temporarily unreachable — please try again in a moment.'
            : raw;
      setError(friendly);
      setPhase('error');
    }
  }

  useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(() => window.close(), 1200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-lg font-semibold text-fg-primary">Connect Pointer</span>
        <p className="text-sm text-fg-muted">
          Link the Pointer browser extension to your account. It gets read-only
          intelligence access — it can never move your funds, and you can disconnect
          any time.
        </p>
      </div>

      {!validExt ? (
        <p className="text-sm text-signal-bear">
          Missing or invalid extension id. Open this from the extension&rsquo;s Connect button.
        </p>
      ) : !ready ? (
        <p className="text-sm text-fg-muted">Loading…</p>
      ) : !authenticated ? (
        <button
          type="button"
          onClick={() => login()}
          className="btn-press rounded-md bg-accent-primary px-4 py-2 text-sm font-semibold text-fg-inverse"
        >
          Sign in to continue
        </button>
      ) : phase === 'done' ? (
        <p className="text-sm font-medium text-signal-bull">Connected — you can close this tab.</p>
      ) : (
        <button
          type="button"
          onClick={approve}
          disabled={phase === 'authorizing' || phase === 'sending'}
          className="btn-press rounded-md bg-accent-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse disabled:opacity-60"
        >
          {phase === 'authorizing' || phase === 'sending' ? 'Connecting…' : 'Approve & connect'}
        </button>
      )}

      {error ? <p className="text-xs text-signal-bear">{error}</p> : null}
    </div>
  );
}
