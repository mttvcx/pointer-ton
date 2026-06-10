'use client';

export const POINTER_OAUTH_MESSAGE = 'pointer:oauth-complete' as const;

export type OAuthPopupProvider = 'google' | 'twitter';

const POPUP_FEATURES = 'popup=yes,width=520,height=720,menubar=no,toolbar=no,location=yes,status=no';

function popupOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/** Privy whitelabel OAuth uses full-page redirect — run it in a popup so the app stays put. */
export function loginWithOAuthPopup(provider: OAuthPopupProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('oauth_unavailable'));
      return;
    }

    const origin = popupOrigin();
    const url = `${origin}/auth/oauth?provider=${encodeURIComponent(provider)}`;
    const popup = window.open(url, 'pointer_oauth', POPUP_FEATURES);

    if (!popup) {
      reject(new Error('popup_blocked'));
      return;
    }

    let settled = false;
    let gotMessage = false;
    const finish = (ok: boolean, err?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.removeEventListener('message', onMessage);
      try {
        popup.close();
      } catch {
        /* no-op */
      }
      if (ok) resolve();
      else reject(err instanceof Error ? err : new Error('oauth_failed'));
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as { type?: string; ok?: boolean } | null;
      if (data?.type !== POINTER_OAUTH_MESSAGE) return;
      gotMessage = true;
      finish(Boolean(data.ok));
    };

    window.addEventListener('message', onMessage);

    const pollId = window.setInterval(() => {
      if (popup.closed && !gotMessage) {
        finish(false, new Error('oauth_cancelled'));
      }
    }, 400);

    window.setTimeout(() => {
      if (!settled) finish(false, new Error('oauth_timeout'));
    }, 5 * 60_000);
  });
}

/** Remove Privy OAuth query junk after a full-page redirect fallback. */
export function stripPrivyOAuthSearchParams(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const keys = ['privy_oauth_state', 'privy_oauth_provider', 'privy_oauth_code'];
  if (!keys.some((k) => url.searchParams.has(k))) return false;
  for (const k of keys) url.searchParams.delete(k);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
  return true;
}
