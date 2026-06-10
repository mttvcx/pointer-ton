'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLoginWithOAuth, usePrivy } from '@privy-io/react-auth';
import { POINTER_OAUTH_MESSAGE, type OAuthPopupProvider } from '@/lib/auth/oauthPopup';

function OAuthBridgeInner() {
  const params = useSearchParams();
  const provider = params.get('provider') as OAuthPopupProvider | null;
  const returning = params.has('privy_oauth_code');
  const { ready, authenticated } = usePrivy();
  const startedRef = useRef(false);
  const notifiedRef = useRef(false);

  const notifyOpener = (ok: boolean) => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: POINTER_OAUTH_MESSAGE, ok }, window.location.origin);
    }
    window.setTimeout(() => window.close(), ok ? 120 : 400);
  };

  const { initOAuth } = useLoginWithOAuth({
    onComplete: () => notifyOpener(true),
    onError: () => notifyOpener(false),
  });

  useEffect(() => {
    if (!ready || !authenticated) return;
    notifyOpener(true);
  }, [ready, authenticated]);

  useEffect(() => {
    if (!ready || startedRef.current || returning) return;
    if (provider !== 'google' && provider !== 'twitter') return;
    startedRef.current = true;
    void initOAuth({ provider }).catch(() => notifyOpener(false));
  }, [ready, returning, provider, initOAuth]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg-base px-6 text-center text-sm text-fg-muted">
      <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
      <p>{returning ? 'Finishing sign-in…' : 'Opening secure sign-in…'}</p>
      <p className="max-w-xs text-[11px] text-fg-muted/80">You can close this window once it completes.</p>
    </div>
  );
}

export default function OAuthBridgePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base text-sm text-fg-muted">
          Loading…
        </div>
      }
    >
      <OAuthBridgeInner />
    </Suspense>
  );
}
